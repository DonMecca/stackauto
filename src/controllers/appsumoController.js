// AppSumo Controller: Manages AppSumo listing operations
const ScraperService = require('../services/scraperService');
const AppSumoListingRepository = require('../repositories/appsumoListingRepository');
const SchedulerService = require('../services/schedulerService');
const EventEmitter = require('events');

class AppSumoController extends EventEmitter {
  constructor() {
    super();
    this.scraperService = new ScraperService();
    this.repository = new AppSumoListingRepository();
    this.schedulerService = new SchedulerService();
    this.isInitialized = false;
    
    // Scan state tracking
    this.scanState = {
      isScanning: false,
      isPaused: false,
      lastScanOptions: null,
      currentProgress: {
        currentPage: 0,
        totalPages: 0
      }
    };
    
    // Forward scraper events
    this.scraperService.on('scraping:start', () => {
      this.scanState.isScanning = true;
      this.scanState.isPaused = false;
      // This is an internal event forwarding, mainWindow.webContents.send for 'scan:started' is handled in scanForNewListings
      this.emit('scraping:start');
    });
    
    this.scraperService.on('scraping:complete', (listings) => {
      this.scanState.isScanning = false;
      this.scanState.isPaused = false;
      // This is an internal event forwarding, mainWindow.webContents.send for 'scan:finished' is handled in scanForNewListings
      this.emit('scraping:complete', listings);
    });
    
    this.scraperService.on('scraping:error', (error) => {
      this.scanState.isScanning = false;
      this.scanState.isPaused = false;
      // This is an internal event forwarding, mainWindow.webContents.send for 'scan:error' is handled in scanForNewListings
      this.emit('scraping:error', error);
    });
    
    // Forward scheduler events
    this.schedulerService.on('job:start', (data) => this.emit('job:start', data));
    this.schedulerService.on('job:complete', (data) => this.emit('job:complete', data));
    this.schedulerService.on('job:error', (data) => this.emit('job:error', data));
  }
  
  /**
   * Initialize the AppSumo controller
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    if (this.isInitialized) return;
    
    try {
      // Initialize scheduler
      this.schedulerService.initialize();
      
      // Load existing listings
      await this.repository.load();
      
      // Set up scheduled scanning if enabled
      if (options.enableScheduledScans !== false) {
        const intervalMinutes = options.scanIntervalMinutes || 60; // Default to hourly
        this.schedulerService.scheduleJob(
          'appsumo-scan',
          async () => await this.scanForNewListings(500, true),
          intervalMinutes,
          options.scanImmediately === true
        );
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      console.log('AppSumoController initialized');
      
    } catch (error) {
      console.error('Error initializing AppSumoController:', error);
      this.emit('initialization:error', error);
      throw error;
    }
  }
  
  /**
   * Scan AppSumo for new listings
   * @param {Object|number} options - Either scanning options object or legacy maxListings parameter
   * @param {number} options.maxListings - Maximum number of listings to scrape
   * @param {number} options.maxScrolls - Maximum number of scroll attempts
   * @param {number} options.paginationDelay - Delay in ms between pagination actions
   * @param {number} options.maxStaleBatches - Maximum number of empty batches before stopping
   * @param {boolean} options.debug - Enable debug mode (screenshots)
   * @param {boolean} options.verbose - Enable verbose logging
   * @param {boolean} options.batchProcessing - Process in batches
   * @param {boolean} options.downloadImages - Whether to download images for listings
   * @param {boolean} [downloadImages] - Legacy parameter for backward compatibility
   * @returns {Promise<Array>} - Newly found listings
   */
  async scanForNewListings(options = {}, legacyDownloadImages) {    
    // Don't start a new scan if already scanning and not paused
    if (this.scanState.isScanning && !this.scanState.isPaused) {
      console.log('Scan already in progress, ignoring request');
      return { alreadyScanning: true };
    }
    
    // If we're resuming a paused scan, use the last options
    if (this.scanState.isPaused && this.scanState.lastScanOptions) {
      options = this.scanState.lastScanOptions;
      // When resuming, we want to start from the last page we were on
      options.resumeFromPage = this.scanState.currentProgress.currentPage;
      console.log('Resuming scan from page', options.resumeFromPage);
    }
    
    // Handle backward compatibility with old method signature
    let scraperOptions;
    
    if (typeof options === 'number' || typeof options === 'undefined') {
      // Old signature: scanForNewListings(maxListings, downloadImages)
      const maxListings = options || 500;
      const downloadImages = typeof legacyDownloadImages !== 'undefined' ? legacyDownloadImages : true;
      scraperOptions = { maxListings, downloadImages };
    } else {
      // New signature: scanForNewListings(options)
      scraperOptions = {
        maxListings: options.maxListings || 50,
        maxScrolls: options.maxScrolls || 20,
        paginationDelay: options.paginationDelay || 2500,
        maxStaleBatches: options.maxStaleBatches || 4,
        debug: Boolean(options.debug),
        verbose: Boolean(options.verbose),
        batchProcessing: options.batchProcessing !== false,
        downloadImages: options.downloadImages !== false,
        resumeFromPage: options.resumeFromPage || 0
      };
    }
    
    // Save the options for potential resume later
    this.scanState.lastScanOptions = {...scraperOptions};
    
    try {
      // Update scan state
      this.scanState.isScanning = true;
      this.scanState.isPaused = false;
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('scan:started');
      }
      
      this.emit('scan:start');
      
      // Forward progress events from scraper to controller
      const progressHandler = (data) => {
        // Update the current progress for potential resume
        this.scanState.currentProgress.currentPage = data.currentPage;
        this.scanState.currentProgress.totalPages = data.totalPages;
        
        // Forward the event
        if (this.mainWindow) {
          this.mainWindow.webContents.send('scan:progress', this.scanState.currentProgress);
        }
        this.emit('scraping:progress', data);
      };
      
      // Forward image processing events from scraper to controller
      const imageProgressHandler = (data) => {
        this.emit('image-processing:progress', data);
      };
      
      // Add event listeners
      this.scraperService.on('scraping:progress', progressHandler);
      this.scraperService.on('image-processing:progress', imageProgressHandler);
      
      console.log('Starting scrape with options:', scraperOptions);
      // Scrape all current listings with enhanced parameters
      const scrapedListings = await this.scraperService.scrapeAllListings(scraperOptions);
      
      // Remove event listeners to avoid memory leaks
      this.scraperService.off('scraping:progress', progressHandler);
      this.scraperService.off('image-processing:progress', imageProgressHandler);
      
      // Reset scan state
      this.scanState.isScanning = false;
      this.scanState.isPaused = false;
      
      // Add new listings to repository (only returns newly added ones)
      const newListings = await this.repository.addListings(scrapedListings);
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('scan:finished', {
          listings: newListings,
          count: newListings.length,
          totalProcessed: scrapedListings.length
        });
      }
      
      this.emit('scan:complete', { 
        total: scrapedListings.length,
        new: newListings.length,
        newListings
      });
      
      return newListings;
    } catch (error) {
      // Reset scan state on error, unless it was paused
      if (!this.scanState.isPaused) {
        this.scanState.isScanning = false;
      }
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('scan:error', { message: error.message });
      }
      
      this.emit('scan:error', error);
      console.error('Error scanning for new listings:', error);
      throw error;
    }
  }
  
  /**
   * Stop the current scan in progress
   * @returns {Promise<Object>} Result with success status
   */
  async stopScanning() {
    // Can only stop if currently scanning and not already paused
    if (!this.scanState.isScanning || this.scanState.isPaused) {
      return { success: false, reason: 'No active scan to stop' };
    }
    
    try {
      // Set the state to paused
      this.scanState.isPaused = true;
      
      // Tell the scraper service to pause
      await this.scraperService.pauseScraping();
      
      // Emit paused event with current progress
      if (this.mainWindow) {
        this.mainWindow.webContents.send('scan:paused', { 
          currentPage: this.scanState.currentProgress.currentPage, 
          totalPages: this.scanState.currentProgress.totalPages 
        });
      }
      
      this.emit('scan:paused', { 
        currentPage: this.scanState.currentProgress.currentPage, 
        totalPages: this.scanState.currentProgress.totalPages 
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error stopping scan:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Resume a previously paused scan
   * @returns {Promise<Object>} Result with success status
   */
  async resumeScanning() {
    // Can only resume if currently paused
    if (!this.scanState.isScanning || !this.scanState.isPaused) {
      return { success: false, reason: 'No paused scan to resume' };
    }
    
    try {
      // Emit resumed event
      if (this.mainWindow) {
        this.mainWindow.webContents.send('scan:resumed', { 
          currentPage: this.scanState.currentProgress.currentPage, 
          totalPages: this.scanState.currentProgress.totalPages 
        });
      }
      
      this.emit('scan:resumed', { 
        currentPage: this.scanState.currentProgress.currentPage, 
        totalPages: this.scanState.currentProgress.totalPages 
      });
      
      // Start scanning again with the saved options
      const result = await this.scanForNewListings();
      return { success: true, result };
    } catch (error) {
      console.error('Error resuming scan:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Get the current scan state
   * @returns {Object} Current scan state
   */
  getScanState() {
    return {
      isScanning: this.scanState.isScanning,
      isPaused: this.scanState.isPaused,
      currentProgress: { ...this.scanState.currentProgress }
    };
  }
  
  /**
   * Get all listings
   * @returns {Promise<Array>} - All listings
   */
  async getAllListings() {
    return this.repository.getListings();
  }
  
  /**
   * Get listings by status
   * @param {string} status - Status to filter by ('new', 'in-progress', 'completed')
   * @returns {Promise<Array>} - Filtered listings
   */
  async getListingsByStatus(status) {
    return this.repository.getListingsByStatus(status);
  }
  
  /**
   * Update listing status
   * @param {string} id - Listing ID
   * @param {string} status - New status
   * @param {string} notes - Optional notes
   * @returns {Promise<Object>} - Updated listing
   */
  async updateListingStatus(id, status, notes = '') {
    const updatedListing = await this.repository.updateListingStatus(id, status, notes);
    if (updatedListing) {
      this.emit('listing:updated', updatedListing);
    }
    return updatedListing;
  }
  
  /**
   * Get the scheduled scan job details
   * @returns {Object|null} - Job details or null if not scheduled
   */
  getScheduledScanJob() {
    const jobs = this.schedulerService.getJobs();
    return jobs.find(job => job.id === 'appsumo-scan') || null;
  }
  
  /**
   * Run the scan job immediately
   * @returns {Promise<boolean>} - Success status
   */
  async runScanNow() {
    try {
      await this.scanForNewListings();
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Update scan schedule
   * @param {number} intervalMinutes - New interval in minutes
   * @returns {boolean} - Success status
   */
  updateScanSchedule(intervalMinutes) {
    try {
      // Clear existing job
      this.schedulerService.clearJob('appsumo-scan');
      
      // Schedule new job with updated interval
      this.schedulerService.scheduleJob(
        'appsumo-scan',
        async () => await this.scanForNewListings(500, true),
        intervalMinutes,
        false
      );
      
      return true;
    } catch (error) {
      console.error('Error updating scan schedule:', error);
      return false;
    }
  }
  
  /**
   * Run diagnostics to identify repository issues
   * @returns {Promise<Object>} - Diagnostic information
   */
  async diagnoseRepository() {
    try {
      console.log('Running repository diagnostics');
      
      // Get diagnostic information from the repository
      const repositoryDiagnostics = await this.repository.diagnose();
      
      // Get current listings for reference
      const listings = await this.repository.getListings();
      
      // Enhanced diagnostic info
      const result = {
        ...repositoryDiagnostics,
        controllerInfo: {
          isInitialized: this.isInitialized,
          scanState: this.scanState,
          listingsCount: listings.length,
        },
        // Sample the first few listings for inspection
        sampleListings: listings.slice(0, 3).map(l => ({
          id: l.id,
          title: l.title,
          completionStatus: l.completionStatus,
          url: l.url
        }))
      };
      
      console.log('Diagnostic complete:', result);
      return result;
    } catch (error) {
      console.error('Error running diagnostics:', error);
      return { error: error.message };
    }
  }
}

module.exports = AppSumoController;

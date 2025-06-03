// Repository for managing AppSumo listings
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const AppSumoListing = require('../models/appsumoListing');

// Debugging flag
const DEBUG = true;

// Log repository operations if debug is enabled
function log(...args) {
  if (DEBUG) {
    console.log('[AppSumoListingRepository]', ...args);
  }
}

class AppSumoListingRepository {
  constructor() {
    // Try multiple paths to find the listings file
    const appPath = app.getAppPath();
    const userDataPath = app.getPath('userData');
    
    // Possible file paths in priority order
    this.possiblePaths = [
      // Primary path - in the project's output directory
      path.join(appPath, 'output', 'appsumo-listings.json'),
      
      // Alternative paths in case the primary isn't accessible
      path.join(process.cwd(), 'output', 'appsumo-listings.json'),
      path.join(userDataPath, 'appsumo-listings.json'),
      path.join(__dirname, '..', '..', 'output', 'appsumo-listings.json')
    ];
    
    // Default to the first path
    this.dataFile = this.possiblePaths[0];
    this.actualPath = null; // Will be set when a file is successfully loaded
    
    this.listings = [];
    this.loaded = false;
    
    log('Initialized with possible paths:', this.possiblePaths);
  }

  // Load listings from storage
  async load() {
    if (this.loaded) {
      log('Already loaded, returning cached listings:', this.listings.length);
      return this.listings;
    }
    
    // Try each possible path in order
    for (const filePath of this.possiblePaths) {
      try {
        log('Attempting to load from:', filePath);
        
        if (fs.existsSync(filePath)) {
          log('File exists, reading content...');
          const data = await fs.promises.readFile(filePath, 'utf8');
          
          if (!data || data.trim() === '') {
            log('File is empty, trying next path');
            continue;
          }
          
          try {
            const parsed = JSON.parse(data);
            
            // Check if it's an array directly or wrapped in an object property
            let itemsArray = parsed;
            if (!Array.isArray(parsed) && parsed.listings && Array.isArray(parsed.listings)) {
              log('Found listings array inside object');
              itemsArray = parsed.listings;
            }
            
            if (!Array.isArray(itemsArray)) {
              log('Data is not an array, found:', typeof itemsArray);
              continue;
            }
            
            log(`Successfully parsed JSON with ${itemsArray.length} listings`);
            this.listings = itemsArray.map(item => {
              try {
                return AppSumoListing.fromObject(item);
              } catch (modelError) {
                log('Error converting item to AppSumoListing:', modelError);
                // Return a basic listing with available data
                return new AppSumoListing({
                  id: item.id || null,
                  title: item.title || 'Unknown Product',
                  url: item.url || '',
                  imageUrl: item.imageUrl || '',
                  category: item.category || '',
                });
              }
            });
            
            this.actualPath = filePath;
            this.dataFile = filePath;
            this.loaded = true;
            
            log(`Successfully loaded ${this.listings.length} listings from ${filePath}`);
            return this.listings;
          } catch (parseError) {
            log('Error parsing JSON from file:', parseError);
            // Continue to next path if this one fails
          }
        } else {
          log('File does not exist:', filePath);
        }
      } catch (fileError) {
        log('Error accessing file:', filePath, fileError);
        // Continue to next path
      }
    }
    
    // If we reach here, all paths failed
    log('WARNING: All file paths failed, creating new empty file at', this.dataFile);
    try {
      // Make sure the directory exists
      const dir = path.dirname(this.dataFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log('Created directory:', dir);
      }
      
      await fs.promises.writeFile(this.dataFile, JSON.stringify([]));
      this.listings = [];
      this.loaded = true;
      this.actualPath = this.dataFile;
      log('Created empty listings file at:', this.dataFile);
    } catch (createError) {
      console.error('CRITICAL ERROR: Failed to create empty listings file:', createError);
    }
    
    return this.listings;
  }

  // Save listings to storage
  async save() {
    try {
      // Ensure we have a valid path to save to
      const savePath = this.actualPath || this.dataFile;
      const dir = path.dirname(savePath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        log('Creating directory for listings:', dir);
        fs.mkdirSync(dir, { recursive: true });
      }
      
      log(`Saving ${this.listings.length} listings to ${savePath}`);
      await fs.promises.writeFile(
        savePath,
        JSON.stringify(this.listings, null, 2)
      );
      
      log('Listings saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save AppSumo listings:', error);
      return false;
    }
  }
  
  // Diagnostic method to help debug data issues
  async diagnose() {
    try {
      await this.load();
      
      const diagnosticInfo = {
        loadedFrom: this.actualPath || 'No file loaded successfully',
        possiblePaths: this.possiblePaths,
        dataFileConfig: this.dataFile,
        listingsCount: this.listings.length,
        firstListing: this.listings.length > 0 ? {
          id: this.listings[0].id,
          title: this.listings[0].title,
          status: this.listings[0].completionStatus
        } : null,
        lastListing: this.listings.length > 0 ? {
          id: this.listings[this.listings.length - 1].id,
          title: this.listings[this.listings.length - 1].title,
          status: this.listings[this.listings.length - 1].completionStatus
        } : null
      };
      
      log('Repository diagnostic information:', diagnosticInfo);
      return diagnosticInfo;
    } catch (error) {
      console.error('Error during repository diagnosis:', error);
      return { error: error.message };
    }
  }

  // Add a new listing if it doesn't exist
  async addListing(listing) {
    await this.load();
    
    // Check if listing with same URL already exists
    const existingIndex = this.listings.findIndex(item => 
      item.url === listing.url
    );
    
    if (existingIndex >= 0) {
      // Already exists, don't add duplicate
      return { added: false, listing: this.listings[existingIndex] };
    }
    
    // Add new listing
    this.listings.push(listing);
    await this.save();
    return { added: true, listing };
  }

  // Add multiple listings at once, returning only new ones
  async addListings(listings) {
    await this.load();
    
    const results = [];
    for (const listing of listings) {
      const result = await this.addListing(listing);
      if (result.added) {
        results.push(result.listing);
      }
    }
    
    return results;
  }

  // Get all listings
  async getListings() {
    await this.load();
    return this.listings;
  }

  // Get listings filtered by status
  async getListingsByStatus(status) {
    await this.load();
    return this.listings.filter(listing => listing.completionStatus === status);
  }

  // Get listing by ID
  async getListingById(id) {
    await this.load();
    return this.listings.find(listing => listing.id === id) || null;
  }

  // Get listing by URL
  async getListingByUrl(url) {
    await this.load();
    return this.listings.find(listing => listing.url === url) || null;
  }

  // Update listing status
  async updateListingStatus(id, status, notes = '') {
    await this.load();
    
    const listing = await this.getListingById(id);
    if (!listing) return null;
    
    switch (status) {
      case 'new':
        listing.markAsNew();
        break;
      case 'in-progress':
        listing.markInProgress(notes);
        break;
      case 'completed':
        listing.markCompleted(notes);
        break;
      default:
        return null;
    }
    
    await this.save();
    return listing;
  }

  // Delete a listing
  async deleteListing(id) {
    await this.load();
    
    const initialLength = this.listings.length;
    this.listings = this.listings.filter(listing => listing.id !== id);
    
    if (this.listings.length !== initialLength) {
      await this.save();
      return true;
    }
    
    return false;
  }

  // Clear all listings (use with caution)
  async clearAllListings() {
    this.listings = [];
    await this.save();
    return true;
  }
}

module.exports = AppSumoListingRepository;

// Simplified AppSumo UI renderer that doesn't use Node.js require/exports

// Global object to store AppSumo UI functions
window.appSumoUI = {};

// Global state for the scraper
const scraperState = {
  isScanning: false,
  isPaused: false,
  progress: {
    currentPage: 0,
    totalPages: 0,
    percent: 0
  }
};

// Function to sync scan state with backend
async function syncScanStateWithBackend() {
  try {
    const state = await window.electronAPI.invoke('appsumo-get-scan-state');
    console.log('Initial scan state from backend:', state);
    scraperState.isScanning = state.isScanning;
    scraperState.isPaused = state.isPaused;
    if (state.currentProgress) {
      scraperState.progress.currentPage = state.currentProgress.currentPage || 0;
      scraperState.progress.totalPages = state.currentProgress.totalPages || 0;
      scraperState.progress.percent = state.currentProgress.totalPages > 0 ? (state.currentProgress.currentPage / state.currentProgress.totalPages) * 100 : 0;
      updateProgressBar(scraperState.progress.percent);
    }
    updateUIState(); // Update UI after syncing
  } catch (err) {
    console.error('Error syncing scan state with backend:', err);
    // Default to idle if sync fails
    scraperState.isScanning = false;
    scraperState.isPaused = false;
    updateUIState();
  }
}

// Initialize AppSumo UI
appSumoUI.initAppSumoUI = function() {
  console.log('Initializing AppSumo UI');
  setupAppSumoEventListeners();
  loadAppSumoListings();
  // Initial UI setup & sync with backend state
  syncScanStateWithBackend();
  updateUIState();
};

// Setup event listeners for AppSumo UI elements
function setupAppSumoEventListeners() {
  console.log('Setting up AppSumo event listeners');
  
  // Scan button
  const scanButton = document.getElementById('appsumo-scan-btn');
  if (scanButton) {
    scanButton.addEventListener('click', () => {
      scanForAppSumoListings();
    });
  }
  
  // Stop scan button
  const stopButton = document.getElementById('appsumo-stop-btn');
  if (stopButton) {
    stopButton.addEventListener('click', () => {
      stopScanning();
    });
  }
  
  // Resume scan button
  const resumeButton = document.getElementById('appsumo-resume-btn');
  if (resumeButton) {
    resumeButton.addEventListener('click', () => {
      resumeScanning();
    });
  }
  
  // Tab buttons
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      // Add active class to clicked tab
      button.classList.add('active');
      // Load listings for this tab
      const status = button.getAttribute('data-tab');
      loadAppSumoListingsByStatus(status);
    });
  });
  
  // Update schedule button
  const updateScheduleBtn = document.getElementById('appsumo-update-schedule-btn');
  if (updateScheduleBtn) {
    updateScheduleBtn.addEventListener('click', () => updateScanSchedule());
  }
  
  // Listen for IPC events from main process
  window.electronAPI.on('appsumo:scan-started', () => { // Renamed for consistency
    console.log('Received appsumo:scan-started event');
    scraperState.isScanning = true;
    scraperState.isPaused = false;
    updateUIState();
    
    // Show progress bar
    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
      progressContainer.classList.add('active');
    }
  });
  
  window.electronAPI.on('appsumo:scan-progress', (event, data) => { // Renamed for consistency
    console.log('Received appsumo:scan-progress event:', data);
    // Update scraper state
    scraperState.progress.currentPage = data.currentPage;
    scraperState.progress.totalPages = data.totalPages;
    scraperState.progress.percent = (data.currentPage / data.totalPages) * 100;
    
    // Update UI
    updateProgressBar(scraperState.progress.percent);
    updateUIState();
  });
  
  window.electronAPI.on('appsumo:scan-finished', (event, listings) => { // Renamed for consistency, listings might be part of a data object
    console.log('Received appsumo:scan-finished event:', listings ? listings.length : 'no listings data');
    scraperState.isScanning = false;
    scraperState.isPaused = false;
    updateUIState();
    
    // Reset progress bar
    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
      progressContainer.classList.remove('active');
    }
    
    loadAppSumoListings(); // Refresh listings
  });
  
  window.electronAPI.on('appsumo:scan-complete', (event, data) => {
    console.log('Received scan-complete event');
    scraperState.isScanning = false;
    scraperState.isPaused = false;
    updateUIState();
    
    // Reset progress bar
    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
      progressContainer.classList.remove('active');
    }
  });
  
  window.electronAPI.on('appsumo:scan-paused', (event, data) => {
    console.log('Received scan-paused event');
    scraperState.isScanning = true;
    scraperState.isPaused = true;
    updateUIState();
  });
  
  window.electronAPI.on('appsumo:scan-resumed', (event, data) => {
    console.log('Received scan-resumed event');
    scraperState.isScanning = true;
    scraperState.isPaused = false;
    updateUIState();
  });
  
  window.electronAPI.on('appsumo:scan-error', (event, error) => {
    console.error('Received scan-error event:', error);
    scraperState.isScanning = false;
    scraperState.isPaused = false;
    updateUIState();
    
    // Reset progress bar
    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) {
      progressContainer.classList.remove('active');
    }
    
    // Show error message
    const statusElement = document.getElementById('appsumo-scan-status');
    if (statusElement) {
      statusElement.innerHTML = `<span style="color: var(--danger-color)">Error: ${error.message || 'Unknown error'}</span>`;
    }
  });
}

// Load all AppSumo listings
async function loadAppSumoListings() {
  try {
    console.log('Frontend: Loading all AppSumo listings...');
    const listings = await window.electronAPI.invoke('appsumo-get-all-listings');
    console.log('Frontend: Received listings:', listings);
    
    // Check if we received an error or no listings
    if (listings && listings.error) {
      console.error('Error from backend:', listings.error);
      showErrorMessage('Failed to load listings: ' + listings.error);
      return;
    }
    
    if (!Array.isArray(listings) || listings.length === 0) {
      console.warn('No listings received or not in expected format:', listings);
      // Explicitly clear the container and show 'no listings' message
      renderAppSumoListings(null); 
      showWarningMessage('No listings found or data format issue. Running diagnostics...');
      runRepositoryDiagnostics();
      return;
    }
    
    // Render the listings
    renderAppSumoListings(listings);
  } catch (error) {
    console.error('Error loading AppSumo listings:', error);
    showErrorMessage('Failed to load listings: ' + error.message);
  }
}

// Run diagnostic on the repository
async function runRepositoryDiagnostics() {
  try {
    console.log('Frontend: Running repository diagnostics...');
    
    // Create diagnostic container if it doesn't exist
    let diagnosticContainer = document.getElementById('diagnostic-container');
    if (!diagnosticContainer) {
      diagnosticContainer = document.createElement('div');
      diagnosticContainer.id = 'diagnostic-container';
      diagnosticContainer.className = 'diagnostic-box';
      document.body.appendChild(diagnosticContainer);
      
      // Add some basic styles
      const style = document.createElement('style');
      style.textContent = `
        .diagnostic-box {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 400px;
          max-height: 80vh;
          overflow-y: auto;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 15px;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          z-index: 1000;
        }
        .diagnostic-title {
          font-weight: bold;
          margin-bottom: 10px;
          font-size: 16px;
          border-bottom: 1px solid #dee2e6;
          padding-bottom: 5px;
        }
        .diagnostic-content {
          font-family: monospace;
          white-space: pre-wrap;
          font-size: 12px;
        }
        .diagnostic-actions {
          margin-top: 15px;
          text-align: right;
        }
        .diagnostic-actions button {
          margin-left: 5px;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Update content
    diagnosticContainer.innerHTML = `
      <div class="diagnostic-title">AppSumo Repository Diagnostics</div>
      <div class="diagnostic-content">Running diagnostics...</div>
      <div class="diagnostic-actions">
        <button id="close-diagnostic">Close</button>
        <button id="retry-load">Retry Loading</button>
      </div>
    `;
    
    // Add event listeners
    document.getElementById('close-diagnostic').addEventListener('click', () => {
      diagnosticContainer.remove();
    });
    document.getElementById('retry-load').addEventListener('click', () => {
      diagnosticContainer.remove();
      loadAppSumoListings();
    });
    
    // Call the backend diagnostic endpoint
    const result = await window.electronAPI.invoke('appsumo-diagnose-repository');
    console.log('Frontend: Diagnostic result:', result);
    
    // Display results
    let content = '';
    if (result.success) {
      content = JSON.stringify(result.info, null, 2);
    } else {
      content = `Error: ${result.error || 'Unknown error'}`;
    }
    
    diagnosticContainer.querySelector('.diagnostic-content').textContent = content;
    
    return result;
  } catch (error) {
    console.error('Error running diagnostics:', error);
    showErrorMessage('Failed to run diagnostics: ' + error.message);
    return { success: false, error: error.message };
  }
}

// Show error message to user
function showErrorMessage(message) {
  // Create container for messages if it doesn't exist
  let messageContainer = document.getElementById('message-container');
  if (!messageContainer) {
    messageContainer = document.createElement('div');
    messageContainer.id = 'message-container';
    messageContainer.style.position = 'fixed';
    messageContainer.style.bottom = '20px';
    messageContainer.style.left = '20px';
    messageContainer.style.zIndex = '1000';
    document.body.appendChild(messageContainer);
  }
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert alert-danger';
  errorDiv.style.marginBottom = '10px';
  errorDiv.innerHTML = `<strong>Error:</strong> ${message} <button class="close">&times;</button>`;
  
  errorDiv.querySelector('.close').addEventListener('click', () => {
    errorDiv.remove();
  });
  
  messageContainer.appendChild(errorDiv);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 10000);
}

// Show warning message to user
function showWarningMessage(message) {
  let messageContainer = document.getElementById('message-container');
  if (!messageContainer) {
    messageContainer = document.createElement('div');
    messageContainer.id = 'message-container';
    messageContainer.style.position = 'fixed';
    messageContainer.style.bottom = '20px';
    messageContainer.style.left = '20px';
    messageContainer.style.zIndex = '1000';
    document.body.appendChild(messageContainer);
  }
  
  const warningDiv = document.createElement('div');
  warningDiv.className = 'alert alert-warning';
  warningDiv.style.marginBottom = '10px';
  warningDiv.innerHTML = `<strong>Warning:</strong> ${message} <button class="close">&times;</button>`;
  
  warningDiv.querySelector('.close').addEventListener('click', () => {
    warningDiv.remove();
  });
  
  messageContainer.appendChild(warningDiv);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    warningDiv.remove();
  }, 10000);
}

// Load AppSumo listings by status
async function loadAppSumoListingsByStatus(status) {
  try {
    let listings;
    if (status === 'all') {
      listings = await window.electronAPI.invoke('appsumo-get-all-listings');
    } else {
      listings = await window.electronAPI.invoke('appsumo-get-listings-by-status', status);
    }
    renderAppSumoListings(listings);
    return listings;
  } catch (err) {
    console.error(`Failed to load AppSumo listings with status ${status}:`, err);
    return [];
  }
}

// Render AppSumo listings to the UI
function renderAppSumoListings(listings) {
  const container = document.getElementById('appsumo-listings-container');
  const noListingsMessage = document.getElementById('no-listings-message');
  
  if (!container) return;
  
  // Clear previous listings (except the no-listings message)
  Array.from(container.children).forEach(child => {
    if (child.id !== 'no-listings-message') {
      container.removeChild(child);
    }
  });
  
  // Show/hide no listings message
  if (listings && listings.length > 0) {
    if (noListingsMessage) noListingsMessage.style.display = 'none';
    
    // Get the template
    const template = document.getElementById('appsumo-listing-template');
    if (!template) {
      console.error('AppSumo listing template not found!');
      return;
    }
    
    // Create and append listing cards
    listings.forEach(listing => {
      // Clone the template content
      const listingCard = template.content.cloneNode(true).firstElementChild;
      
      // Populate with listing data
      listingCard.querySelector('.listing-title').textContent = listing.title;
      listingCard.querySelector('.listing-price').textContent = listing.price || 'Price not available';
      
      const listingLink = listingCard.querySelector('.listing-url a');
      listingLink.href = listing.url;
      listingLink.textContent = 'View on AppSumo';
      
      const listingImage = listingCard.querySelector('.listing-image');
      if (listingImage) {
        listingImage.src = listing.imageUrl || 'https://via.placeholder.com/80';
        listingImage.alt = listing.title;
      }
      
      listingCard.querySelector('.listing-description').textContent = listing.description || 'No description available';
      
      // Set up status dropdown
      const statusSelect = listingCard.querySelector('.status-select');
      if (statusSelect) {
        for (const option of statusSelect.options) {
          if (option.value === listing.status) {
            option.selected = true;
            break;
          }
        }
      }
      
      // Set up notes input
      const notesInput = listingCard.querySelector('.notes-input');
      if (notesInput) {
        notesInput.value = listing.notes || '';
      }
      
      // Set up update button
      const updateBtn = listingCard.querySelector('.update-status-btn');
      if (updateBtn) {
        updateBtn.addEventListener('click', () => {
          updateListingStatus(listing.id, statusSelect.value, notesInput.value);
        });
      }
      
      // Set up process button
      const processBtn = listingCard.querySelector('.process-listing-btn');
      if (processBtn) {
        processBtn.addEventListener('click', () => {
          processListing(listing);
        });
      }
      
      // Add data attribute for listing ID
      listingCard.dataset.listingId = listing.id;
      
      // Add to container
      container.appendChild(listingCard);
    });
  } else {
    if (noListingsMessage) noListingsMessage.style.display = 'block';
  }
}

// Update a listing's status
async function updateListingStatus(id, status, notes) {
  try {
    const result = await window.electronAPI.invoke('appsumo-update-listing-status', { id, status, notes });
    if (result.success) {
      // Refresh the current tab to show updated data
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab) {
        const status = activeTab.getAttribute('data-tab');
        loadAppSumoListingsByStatus(status);
      } else {
        loadAppSumoListings();
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to update listing status:', err);
    return false;
  }
}

// Process a listing (add to main workflow)
function processListing(listing) {
  console.log('Processing listing:', listing);
  
  // If we have an AppSumo URL field in the main form, populate it
  const appsumoUrlInput = document.getElementById('appsumo-url');
  if (appsumoUrlInput) {
    appsumoUrlInput.value = listing.url;
  }
  
  // Switch to the main workflow tab
  const workflowBtn = document.querySelector('.app-nav-btn:first-child');
  if (workflowBtn) {
    workflowBtn.click();
  }
}

// Scan for new AppSumo listings
async function scanForAppSumoListings() {
  // Don't do anything if already scanning
  if (scraperState.isScanning && !scraperState.isPaused) {
    console.log('Already scanning, ignoring scan request');
    return;
  }
  
  // Update UI state to scanning
  scraperState.isScanning = true;
  scraperState.isPaused = false;
  updateUIState();
  
  // Show active progress bar
  const progressContainer = document.querySelector('.progress-container');
  if (progressContainer) {
    progressContainer.classList.add('active');
  }
  
  try {
    console.log('Starting AppSumo scan...');
    // Invoke scan API
    const result = await window.electronAPI.invoke('appsumo-scan');
    
    if (result.success) {
      console.log('Scan completed successfully');
    } else {
      console.error('Scan failed:', result.error);
      // Update status with error
      const statusElement = document.getElementById('appsumo-scan-status');
      if (statusElement) {
        statusElement.innerHTML = `<span style="color: var(--danger-color)">Error: ${result.error}</span>`;
      }
    }
  } catch (err) {
    console.error('Error during AppSumo scan:', err);
    // Update status with error
    const statusElement = document.getElementById('appsumo-scan-status');
    if (statusElement) {
      statusElement.innerHTML = `<span style="color: var(--danger-color)">Error: ${err.message}</span>`;
    }
    
    // Reset state
    scraperState.isScanning = false;
    scraperState.isPaused = false;
    updateUIState();
    
    // Hide progress bar
    if (progressContainer) {
      progressContainer.classList.remove('active');
    }
  }
}

// Stop the current scan
async function stopScanning() {
  // Only stop if currently scanning and not paused
  if (!scraperState.isScanning || scraperState.isPaused) {
    console.log('Not scanning or already paused, ignoring stop request');
    return;
  }
  
  try {
    console.log('Stopping AppSumo scan...');
    // Invoke stop scan API
    const result = await window.electronAPI.invoke('appsumo-stop-scan');
    
    if (result.success) {
      console.log('Scan paused successfully');
      // Update state to paused
      scraperState.isPaused = true;
      updateUIState();
    } else {
      console.error('Failed to stop scan:', result.error);
    }
  } catch (err) {
    console.error('Error stopping AppSumo scan:', err);
  }
}

// Resume a paused scan
async function resumeScanning() {
  // Only resume if currently paused
  if (!scraperState.isScanning || !scraperState.isPaused) {
    console.log('Not in paused state, ignoring resume request');
    return;
  }
  
  try {
    console.log('Resuming AppSumo scan...');
    // Invoke resume scan API
    const result = await window.electronAPI.invoke('appsumo-resume-scan');
    
    if (result.success) {
      console.log('Scan resumed successfully');
      // Update state to scanning (not paused)
      scraperState.isPaused = false;
      updateUIState();
    } else {
      console.error('Failed to resume scan:', result.error);
    }
  } catch (err) {
    console.error('Error resuming AppSumo scan:', err);
  }
}

// Update the UI based on the current state
function updateUIState() {
  const scanBtn = document.getElementById('appsumo-scan-btn');
  const stopBtn = document.getElementById('appsumo-stop-btn');
  const resumeBtn = document.getElementById('appsumo-resume-btn');
  const statusElement = document.getElementById('appsumo-scan-status');
  
  if (!scanBtn || !stopBtn || !resumeBtn || !statusElement) {
    console.error('Could not find UI elements');
    return;
  }
  
  // Update button visibility based on state
  if (scraperState.isScanning) {
    if (scraperState.isPaused) {
      // Show scan & resume buttons, hide stop button
      scanBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'none';
      resumeBtn.style.display = 'inline-flex';
      
      // Update status
      statusElement.innerHTML = `<span style="color: var(--warning-color)">Paused at page ${scraperState.progress.currentPage}/${scraperState.progress.totalPages}</span>`;
    } else {
      // Show stop button, hide scan & resume buttons
      scanBtn.style.display = 'none';
      stopBtn.style.display = 'inline-flex';
      resumeBtn.style.display = 'none';
      
      // Add ripple effect to stop button
      if (!stopBtn.querySelector('.scan-ripple')) {
        const ripple = document.createElement('span');
        ripple.className = 'scan-ripple';
        stopBtn.appendChild(ripple);
      }
      
      // Update status with scanning animation
      if (scraperState.progress.currentPage > 0) {
        statusElement.innerHTML = `<span class="scan-pulse"></span> Scanning page ${scraperState.progress.currentPage}/${scraperState.progress.totalPages || '?'}`;
      } else {
        statusElement.innerHTML = `<span class="scan-pulse"></span> Initializing scan...`;
      }
    }
  } else {
    // Not scanning - show scan button, hide stop & resume buttons
    scanBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
    resumeBtn.style.display = 'none';
    
    // Remove ripple effect if exists
    const ripple = stopBtn.querySelector('.scan-ripple');
    if (ripple) {
      ripple.remove();
    }
    
    // Update status to idle
    statusElement.textContent = 'Status: Idle';
  }
}

// Update the progress bar
function updateProgressBar(percent) {
  const progressBar = document.querySelector('.progress-bar');
  if (progressBar) {
    progressBar.style.width = `${Math.min(100, percent)}%`;
  }
}

// Update the scan schedule
async function updateScanSchedule() {
  const enableSchedule = document.getElementById('appsumo-enable-schedule');
  const scheduleSelect = document.getElementById('appsumo-scan-schedule');
  
  if (!enableSchedule || !scheduleSelect) return;
  
  const intervalMinutes = enableSchedule.checked ? parseInt(scheduleSelect.value, 10) : 0;
  
  try {
    const result = await window.electronAPI.invoke('appsumo-update-scan-schedule', intervalMinutes);
    if (result.success) {
      console.log(`Schedule updated: ${intervalMinutes} minutes`);
    } else {
      console.error('Failed to update schedule:', result.error);
    }
  } catch (err) {
    console.error('Error updating scan schedule:', err);
  }
}

// Make these functions available globally via the appSumoUI object
appSumoUI.loadAppSumoListings = loadAppSumoListings;
appSumoUI.renderAppSumoListings = renderAppSumoListings;
appSumoUI.updateListingStatus = updateListingStatus;
appSumoUI.processListing = processListing;
appSumoUI.scanForAppSumoListings = scanForAppSumoListings;
appSumoUI.stopScanning = stopScanning;
appSumoUI.resumeScanning = resumeScanning;
appSumoUI.updateScanSchedule = updateScanSchedule;
appSumoUI.updateUIState = updateUIState;
appSumoUI.updateProgressBar = updateProgressBar;

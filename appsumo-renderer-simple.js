// Simplified AppSumo UI renderer that doesn't use Node.js require/exports

// Global object to store AppSumo UI functions
window.appSumoUI = {};

// Initialize AppSumo UI
appSumoUI.initAppSumoUI = function() {
  console.log('Initializing AppSumo UI');
  setupAppSumoEventListeners();
  loadAppSumoListings();
};

// Setup event listeners for AppSumo UI elements
function setupAppSumoEventListeners() {
  console.log('Setting up AppSumo event listeners');
  
  // Scan button
  const scanButton = document.getElementById('appsumo-scan-btn');
  if (scanButton) {
    scanButton.addEventListener('click', () => scanForAppSumoListings());
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
  window.electronAPI.on('appsumo:scraping-start', () => {
    const statusElement = document.getElementById('appsumo-scan-status');
    if (statusElement) {
      statusElement.textContent = 'Status: Scanning...';
    }
  });
  
  window.electronAPI.on('appsumo:scraping-progress', (event, data) => {
    const statusElement = document.getElementById('appsumo-scan-status');
    if (statusElement) {
      statusElement.textContent = `Status: Scanning... ${data.currentPage}/${data.totalPages}`;
    }
  });
  
  window.electronAPI.on('appsumo:scraping-complete', (event, listings) => {
    const statusElement = document.getElementById('appsumo-scan-status');
    if (statusElement) {
      statusElement.textContent = `Status: Completed. Found ${listings.length} listings.`;
    }
    loadAppSumoListings(); // Refresh listings
  });
  
  window.electronAPI.on('appsumo:scan-complete', (event, data) => {
    const statusElement = document.getElementById('appsumo-scan-status');
    if (statusElement) {
      statusElement.textContent = `Status: Idle`;
    }
  });
}

// Load all AppSumo listings
async function loadAppSumoListings() {
  try {
    const listings = await window.electronAPI.invoke('appsumo-get-all-listings');
    renderAppSumoListings(listings);
    return listings;
  } catch (err) {
    console.error('Failed to load AppSumo listings:', err);
    return [];
  }
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
  const statusElement = document.getElementById('appsumo-scan-status');
  if (statusElement) {
    statusElement.textContent = 'Status: Starting scan...';
  }
  
  try {
    const result = await window.electronAPI.invoke('appsumo-scan');
    if (result.success) {
      console.log('Scan completed successfully');
    } else {
      console.error('Scan failed:', result.error);
      if (statusElement) {
        statusElement.textContent = `Status: Error - ${result.error}`;
      }
    }
  } catch (err) {
    console.error('Error during AppSumo scan:', err);
    if (statusElement) {
      statusElement.textContent = `Status: Error - ${err.message}`;
    }
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
appSumoUI.updateScanSchedule = updateScanSchedule;

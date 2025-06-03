const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { runGenSparkAutomation } = require('./gensparkAutomation');

const COOKIES_STORE_PATH = path.join(__dirname, 'gensparkCookiesStore.json');

function loadCookieStore() {
  try {
    if (!fs.existsSync(COOKIES_STORE_PATH)) return { sets: [], activeId: null };
    return JSON.parse(fs.readFileSync(COOKIES_STORE_PATH, 'utf8'));
  } catch { return { sets: [], activeId: null }; }
}
function saveCookieStore(store) {
  fs.writeFileSync(COOKIES_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

ipcMain.handle('genspark-list-cookies', async () => {
  return loadCookieStore();
});
ipcMain.handle('genspark-add-cookies', async (event, { label, cookies }) => {
  const store = loadCookieStore();
  const id = Date.now().toString();
  store.sets.push({ id, label, date: new Date().toISOString(), cookies });
  store.activeId = id;
  saveCookieStore(store);
  return store;
});
ipcMain.handle('genspark-delete-cookies', async (event, id) => {
  const store = loadCookieStore();
  store.sets = store.sets.filter(s => s.id !== id);
  if (store.activeId === id) store.activeId = store.sets.length ? store.sets[0].id : null;
  saveCookieStore(store);
  return store;
});
ipcMain.handle('genspark-set-active-cookies', async (event, id) => {
  const store = loadCookieStore();
  store.activeId = id;
  saveCookieStore(store);
  return store;
});

ipcMain.handle('migrate-legacy-cookies', async () => {
  try {
    // This is a stub implementation for migrating legacy cookies
    // Return empty result as there's nothing to migrate in this test environment
    return { migrated: 0, errors: 0 };
  } catch (err) {
    console.error('Error migrating legacy cookies:', err);
    return { error: err.message };
  }
});



 // <-- Added for GenSpark browser automation

// Import core modules
const GenSparkClient = require('./src/clients/gensparkClient');
const OpenAIClient = require('./src/clients/openaiClient');
const WordPressClient = require('./src/clients/wordpressClient');
const ScraperService = require('./src/services/scraperService');
const ConfigManager = require('./src/services/configManager');
const WorkflowOrchestrator = require('./src/services/workflowOrchestrator');
const AppSumoController = require('./src/controllers/appsumoController');

// Initialize config and core services
const configManager = new ConfigManager();
const scraperService = new ScraperService();
const appsumoController = new AppSumoController();

// Initialize AppSumo controller
appsumoController.initialize({ enableScheduledScans: false }).catch(err => {
  console.error('Failed to initialize AppSumo controller:', err);
});

// Forward AppSumo controller events to renderer via webContents
appsumoController.on('scraping:start', () => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('appsumo:scraping-start');
  });
});

appsumoController.on('scraping:progress', (data) => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('appsumo:scraping-progress', data);
  });
});

appsumoController.on('scraping:complete', (listings) => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('appsumo:scraping-complete', listings);
  });
});

appsumoController.on('scan:complete', (data) => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('appsumo:scan-complete', data);
  });
});

async function createClientsAndOrchestrator() {
  await configManager.ready;
  const gensparkClient = new GenSparkClient({
    gensparkApiKey: await configManager.get('gensparkApiKey') || '',
    gensparkEndpoint: await configManager.get('gensparkEndpoint') || '',
  });
  const openaiClient = new OpenAIClient({
    openaiApiKey: await configManager.get('openaiApiKey') || '',
    openaiEndpoint: await configManager.get('openaiEndpoint') || '',
  });
  
  // Handle potentially undefined WordPress config values
  let wordpressClient;
  try {
    const wordpressSiteUrl = await configManager.get('wordpressSiteUrl') || '';
    wordpressClient = new WordPressClient({
      wordpressSiteUrl: wordpressSiteUrl,
      wordpressAppPassword: await configManager.get('wordpressAppPassword') || '',
      wordpressUsername: await configManager.get('wordpressUsername') || '',
    });
  } catch (err) {
    console.warn('[Main] WordPress client initialization failed:', err.message);
    wordpressClient = {
      uploadMedia: async () => ({ error: 'WordPress client not configured' }),
      createPost: async () => ({ error: 'WordPress client not configured' })
    };
  }
  
  return new WorkflowOrchestrator({
    scraperService,
    gensparkClient,
    openaiClient,
    wordpressClient,
    configManager,
  });
}

let workflowOrchestratorPromise = createClientsAndOrchestrator();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC: Save GenSpark cookies
ipcMain.handle('genspark-save-cookies', async (event, cookies) => {
  try {
    fs.writeFileSync(path.join(__dirname, 'gensparkCookies.json'), JSON.stringify(cookies, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save GenSpark cookies:', e);
    return false;
  }
});

// IPC: WordPress media upload
ipcMain.handle('wordpress-upload-media', async (event, { imagePath, wordpressSiteUrl, wordpressAppPassword, wordpressUsername }) => {
  try {
    const wordpressClient = new WordPressClient({
      wordpressSiteUrl,
      wordpressAppPassword,
      wordpressUsername,
    });
    return await wordpressClient.uploadMedia(imagePath);
  } catch (err) {
    return { error: err.message };
  }
});

// IPC: WordPress connection test
ipcMain.handle('wordpress-test-connection', async (event, { wordpressSiteUrl, wordpressAppPassword, wordpressUsername }) => {
  try {
    const fetch = require('node-fetch');
    const url = `${wordpressSiteUrl.replace(/\/$/, '')}/wp-json/wp/v2/users/me`;
    const auth = Buffer.from(`${wordpressUsername}:${wordpressAppPassword}`).toString('base64');
    const res = await fetch(url, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    if (res.ok) {
      return { success: true };
    } else {
      let msg = `HTTP ${res.status}`;
      try { const data = await res.json(); if (data && data.message) msg += ': ' + data.message; } catch {}
      return { error: msg };
    }
  } catch (err) {
    return { error: err.message };
  }
});

// IPC: WordPress post creation
ipcMain.handle('wordpress-create-post', async (event, postData) => {
  try {
    const wordpressClient = new WordPressClient({
      wordpressSiteUrl: postData.wordpressSiteUrl,
      wordpressAppPassword: postData.wordpressAppPassword,
      wordpressUsername: postData.wordpressUsername,
    });
    // Remove credentials before sending to API
    const cleanPostData = { ...postData };
    delete cleanPostData.wordpressSiteUrl;
    delete cleanPostData.wordpressAppPassword;
    delete cleanPostData.wordpressUsername;
    return await wordpressClient.createPost(cleanPostData);
  } catch (err) {
    return { error: err.message };
  }
});

// IPC: GenSpark browser automation
ipcMain.handle('genspark-run', async (event, { appsumoUrl, promptTemplate, extractionMethod }) => {
  try {
    const store = loadCookieStore();
    const activeSet = store.sets.find(s => s.id === store.activeId);
    const cookies = activeSet ? activeSet.cookies : null;
    const result = await runGenSparkAutomation(appsumoUrl, promptTemplate, extractionMethod || 'clipboard');
    return result;
  } catch (err) {
    return { clipboard: '', dom: '', error: err.message };
  }
});

// IPC: Expose workflow orchestration to renderer
ipcMain.handle('run-workflow', async (event, { appsumoUrl, options }) => {
  try {
    const workflowOrchestrator = await workflowOrchestratorPromise;
    const result = await workflowOrchestrator.runWorkflow(appsumoUrl, options);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Config store access for prompts and strategies
ipcMain.handle('config-get', async (event, key) => {
  try {
    return await configManager.get(key);
  } catch (err) {
    console.error('config-get error', err);
    return null;
  }
});
ipcMain.handle('config-set', async (event, { key, value }) => {
  try {
    await configManager.set(key, value);
    return true;
  } catch (err) {
    console.error('config-set error', err);
    return false;
  }
});

// AppSumo IPC handlers

// Get all AppSumo listings
ipcMain.handle('appsumo-get-all-listings', async () => {
  try {
    return await appsumoController.getAllListings();
  } catch (err) {
    console.error('Error getting AppSumo listings:', err);
    return { error: err.message };
  }
});

// Get AppSumo listings by status
ipcMain.handle('appsumo-get-listings-by-status', async (event, status) => {
  try {
    return await appsumoController.getListingsByStatus(status);
  } catch (err) {
    console.error('Error getting AppSumo listings by status:', err);
    return { error: err.message };
  }
});

// Scan for new AppSumo listings
ipcMain.handle('appsumo-scan', async (event, options = {}) => {
  try {
    const newListings = await appsumoController.scanForNewListings(options);
    return { success: true, newListings };
  } catch (err) {
    console.error('Error scanning for AppSumo listings:', err);
    return { success: false, error: err.message };
  }
});

// Update AppSumo listing status
ipcMain.handle('appsumo-update-listing-status', async (event, { id, status, notes }) => {
  try {
    const updatedListing = await appsumoController.updateListingStatus(id, status, notes);
    return { success: true, listing: updatedListing };
  } catch (err) {
    console.error('Error updating AppSumo listing status:', err);
    return { success: false, error: err.message };
  }
});

// Get scheduled scan job info
ipcMain.handle('appsumo-get-scheduled-job', () => {
  try {
    const job = appsumoController.getScheduledScanJob();
    return { success: true, job };
  } catch (err) {
    console.error('Error getting scheduled job info:', err);
    return { success: false, error: err.message };
  }
});

// Run scan now
ipcMain.handle('appsumo-run-scan-now', async () => {
  try {
    const success = await appsumoController.runScanNow();
    return { success };
  } catch (err) {
    console.error('Error running scan now:', err);
    return { success: false, error: err.message };
  }
});

// Update scan schedule
ipcMain.handle('appsumo-update-scan-schedule', async (event, intervalMinutes) => {
  try {
    const success = appsumoController.updateScanSchedule(intervalMinutes);
    return { success };
  } catch (err) {
    console.error('Error updating scan schedule:', err);
    return { success: false, error: err.message };
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

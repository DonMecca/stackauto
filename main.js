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



 // <-- Added for GenSpark browser automation

// Import core modules
const GenSparkClient = require('./src/clients/gensparkClient');
const OpenAIClient = require('./src/clients/openaiClient');
const WordPressClient = require('./src/clients/wordpressClient');
const ScraperService = require('./src/services/scraperService');
const ConfigManager = require('./src/services/configManager');
const WorkflowOrchestrator = require('./src/services/workflowOrchestrator');

// Initialize config and core services
const configManager = new ConfigManager();
const scraperService = new ScraperService();

async function createClientsAndOrchestrator() {
  await configManager.ready;
  const gensparkClient = new GenSparkClient({
    gensparkApiKey: await configManager.get('gensparkApiKey'),
    gensparkEndpoint: await configManager.get('gensparkEndpoint'),
  });
  const openaiClient = new OpenAIClient({
    openaiApiKey: await configManager.get('openaiApiKey'),
    openaiEndpoint: await configManager.get('openaiEndpoint'),
  });
  const wordpressClient = new WordPressClient({
    wordpressSiteUrl: await configManager.get('wordpressSiteUrl'),
    wordpressAppPassword: await configManager.get('wordpressAppPassword'),
  });
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

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

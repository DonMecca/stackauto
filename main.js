const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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

const { contextBridge, ipcRenderer } = require('electron');

// Expose IPC methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: invoke('some-channel', data)
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  on: (channel, callback) => ipcRenderer.on(channel, callback)
});

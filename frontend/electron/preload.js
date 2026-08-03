const { contextBridge, ipcRenderer } = require('electron');

// Transmettre l'URL de l'API backend au contexte window du frontend React
const apiPort = process.env.OPENSTATS_API_PORT || '5000';
const apiUrl = `http://127.0.0.1:${apiPort}`;

contextBridge.exposeInMainWorld('OPENSTATS_API_URL', apiUrl);

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isDesktop: true,
  apiUrl: apiUrl,
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  }
});

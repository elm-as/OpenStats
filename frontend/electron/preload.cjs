const { contextBridge, ipcRenderer } = require('electron');

const apiPort = process.env.OPENSTATS_API_PORT || '5000';
const apiUrl = `http://127.0.0.1:${apiPort}`;
const sessionToken = process.env.OPENSTATS_SESSION_TOKEN || '';

contextBridge.exposeInMainWorld('OPENSTATS_API_URL', apiUrl);
contextBridge.exposeInMainWorld('OPENSTATS_SESSION_TOKEN', sessionToken);

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isDesktop: true,
  apiUrl: apiUrl,
  sessionToken: sessionToken,
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => {
    const listener = (event, ...args) => func(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});

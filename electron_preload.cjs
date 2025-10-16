const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron,
  
  openExternal: (url) => {
    ipcRenderer.invoke('open-external-url', url);
  },
  
  onWalletConnected: (callback) => {
    ipcRenderer.on('wallet-connected', (event, data) => callback(data));
  },
  
  removeWalletListener: () => {
    ipcRenderer.removeAllListeners('wallet-connected');
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Kodiak Wallet - Electron Preload Script Loaded');
});
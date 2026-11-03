const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  isOffline: true,
  platform: process.platform,
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printReceipt: (content, options) => ipcRenderer.invoke('print-receipt', content, options),
  toggleFullScreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});


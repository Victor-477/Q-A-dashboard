const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qaDashboard', {
  getState: () => ipcRenderer.invoke('service:get-state'),
  start: config => ipcRenderer.invoke('service:start', config),
  stop: () => ipcRenderer.invoke('service:stop'),
  openUrl: url => ipcRenderer.invoke('service:open-url', url),
  downloadLog: () => ipcRenderer.invoke('service:download-log'),
  downloadPdf: () => ipcRenderer.invoke('service:download-pdf'),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('service:state', listener);
    return () => ipcRenderer.removeListener('service:state', listener);
  }
});

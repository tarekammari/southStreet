const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('card', {
  onCall: (cb) => ipcRenderer.on('call', (_e, call) => cb(call)),
  act: (action) => ipcRenderer.send('ss:card-action', action),
});

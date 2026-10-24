const { contextBridge, ipcRenderer } = require('electron');

const soundsArg = process.argv.find((a) => a.startsWith('--ss-sounds=')) || '';

contextBridge.exposeInMainWorld('card', {
  /** file:// folder of the ringtones (outside the app files). */
  sounds: soundsArg.slice('--ss-sounds='.length) || 'assets',
  onCall: (cb) => ipcRenderer.on('call', (_e, call) => cb(call)),
  act: (action) => ipcRenderer.send('ss:card-action', action),
});

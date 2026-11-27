const { contextBridge, ipcRenderer } = require('electron');

const soundsArg = process.argv.find((a) => a.startsWith('--ss-sounds=')) || '';
const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3);

contextBridge.exposeInMainWorld('card', {
  /** file:// folder of the ringtones (outside the app files). */
  sounds: soundsArg.slice('--ss-sounds='.length) || 'assets',
  /** The app's name and icon (an agency build has its own). */
  brand: decodeURIComponent(arg('ss-brand') || '') || 'South Street Connect',
  icon: arg('ss-icon') || 'assets/icon.png',
  onCall: (cb) => ipcRenderer.on('call', (_e, call) => cb(call)),
  act: (action) => ipcRenderer.send('ss:card-action', action),
});

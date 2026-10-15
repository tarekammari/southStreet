/**
 * Bridge between the Connect web app and the Windows shell. The page calls
 * window.ssNative.callState(...) on every call change and listens with
 * window.ssNative.onCallAction(...) for buttons pressed on the floating card.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ssNative', {
  platform: 'windows',
  version: (process.argv.find((a) => a.startsWith('--ss-version=')) || '').slice('--ss-version='.length),
  /** Google sign-in in the real browser (Google blocks it inside apps). */
  openSignIn: (url) => ipcRenderer.send('ss:open-signin', url),
  callState: (state) => ipcRenderer.send('ss:call-state', state),
  onCallAction: (cb) => {
    const handler = (_e, action) => cb(action);
    ipcRenderer.on('ss:call-action', handler);
    return () => ipcRenderer.removeListener('ss:call-action', handler);
  },
});

/**
 * South Street Connect for Windows.
 *
 * The app is the Connect web app (always the latest version from the server)
 * in a desktop shell that behaves like a phone app:
 *  - starts with Windows and keeps running in the tray, so the live connection
 *    stays open and calls arrive even when no window is open;
 *  - an incoming call opens a call card above every window, bottom-right, with
 *    the ringtone looping and Answer / Decline buttons;
 *  - during a call, the same card (timer, mute, hang up) floats above every
 *    window whenever the main window is minimised or hidden.
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, session, shell, Notification } = require('electron');
const path = require('node:path');

const ORIGIN = process.env.SS_CONNECT_ORIGIN || 'https://southstreet.1zayd1.tech';
const START_URL = `${ORIGIN}/connect`;
const ICON = path.join(__dirname, 'assets', 'icon.png');

// Ringtone may play without a click (the call card is not clicked yet).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId('tech.southstreet.connect');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let main = null;
  let card = null;
  let tray = null;
  let quitting = false;
  let call = null; // { phase, id, name, photo, role, connectedAt, muted }

  const showMain = () => {
    if (!main) return;
    if (main.isMinimized()) main.restore();
    main.show();
    main.focus();
  };

  app.on('second-instance', showMain);

  function createMain(hidden) {
    main = new BrowserWindow({
      width: 1100,
      height: 760,
      minWidth: 380,
      minHeight: 560,
      show: !hidden,
      title: 'South Street Connect',
      icon: ICON,
      backgroundColor: '#f4f6f5',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        sandbox: true,
        // Keep the live connection and timers running while hidden in the tray.
        backgroundThrottling: false,
      },
    });
    main.loadURL(START_URL);

    // Links to other sites open in the normal browser.
    main.webContents.setWindowOpenHandler(({ url }) => {
      if (!url.startsWith(ORIGIN)) shell.openExternal(url);
      else main.loadURL(url);
      return { action: 'deny' };
    });

    // Closing the window keeps the app running in the tray, like a phone app.
    main.on('close', (e) => {
      if (quitting) return;
      e.preventDefault();
      main.hide();
    });
    const refreshCard = () => syncCard();
    main.on('minimize', refreshCard);
    main.on('hide', refreshCard);
    main.on('show', refreshCard);
    main.on('restore', refreshCard);
    main.on('focus', () => {
      main.flashFrame(false);
      refreshCard();
    });
  }

  function createTray() {
    tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
    tray.setToolTip('South Street Connect');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'فتح South Street Connect', click: showMain },
        { type: 'separator' },
        {
          label: 'التشغيل مع ويندوز',
          type: 'checkbox',
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }),
        },
        { type: 'separator' },
        { label: 'إغلاق نهائي (لن تصلك المكالمات)', click: () => { quitting = true; app.quit(); } },
      ])
    );
    tray.on('click', showMain);
  }

  /* ---------------- floating call card ---------------- */

  const mainInView = () => main && main.isVisible() && !main.isMinimized() && main.isFocused();

  function syncCard() {
    const ringing = call && call.phase === 'incoming';
    const live = call && ['calling', 'ringing', 'connecting', 'active'].includes(call.phase);
    // Ringing: always on top. In a call: only while the main window is out of sight.
    const wanted = ringing || (live && !mainInView());
    if (!wanted) {
      if (card) {
        card.webContents.send('call', null); // stops the ringtone
        card.hide();
      }
      return;
    }
    if (!card) createCard();
    card.webContents.send('call', call);
    const { workArea } = screen.getPrimaryDisplay();
    const [w, h] = card.getSize();
    card.setPosition(workArea.x + workArea.width - w - 16, workArea.y + workArea.height - h - 16);
    if (!card.isVisible()) card.showInactive();
    card.setAlwaysOnTop(true, 'screen-saver');
  }

  function createCard() {
    card = new BrowserWindow({
      width: 380,
      height: 168,
      frame: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      transparent: true,
      hasShadow: true,
      icon: ICON,
      webPreferences: { preload: path.join(__dirname, 'call-preload.js'), contextIsolation: true, sandbox: true },
    });
    card.loadFile(path.join(__dirname, 'call.html'));
    card.webContents.on('did-finish-load', () => call && card.webContents.send('call', call));
    card.on('closed', () => { card = null; });
  }

  // From the web app: the call changed (incoming, connecting, active, ended…).
  ipcMain.on('ss:call-state', (_e, state) => {
    const wasRinging = call && call.phase === 'incoming';
    call = state && state.phase !== 'ended' ? state : null;
    if (call && call.phase === 'incoming' && !wasRinging) {
      main.flashFrame(true);
      if (Notification.isSupported() && !mainInView()) {
        // Shows in the Action Center too, in case the card was missed.
        new Notification({ title: `📞 ${call.name}`, body: 'مكالمة صوتية واردة', icon: ICON, silent: true }).show();
      }
    }
    if (!call) main.flashFrame(false);
    syncCard();
  });

  // From the call card: answer / decline / mute / hang up / open.
  ipcMain.on('ss:card-action', (_e, action) => {
    if (action === 'answer' || action === 'open') showMain();
    if (main) main.webContents.send('ss:call-action', action);
  });

  app.whenReady().then(() => {
    // The site may use the microphone and show notifications.
    session.defaultSession.setPermissionRequestHandler((wc, permission, done) => {
      const fromSite = wc.getURL().startsWith(ORIGIN);
      done(fromSite && ['media', 'notifications', 'audioCapture', 'clipboard-sanitized-write'].includes(permission));
    });

    if (!app.getLoginItemSettings().openAtLogin && !process.argv.includes('--no-autostart')) {
      // First run: start with Windows by default (can be turned off from the tray).
      app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
    }
    createMain(process.argv.includes('--hidden'));
    createTray();
  });

  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', (e) => e.preventDefault());
}

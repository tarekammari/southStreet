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
 *    window whenever the main window is minimised or hidden;
 *  - updates itself: on start, when opened again and every few hours it asks
 *    the server for a newer version, downloads it and installs it (silently
 *    while in the tray, after one question while the window is open; never
 *    during a call).
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, session, shell, Notification, dialog, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const ORIGIN = process.env.SS_CONNECT_ORIGIN || 'https://southstreet.1zayd1.tech';
const START_URL = `${ORIGIN}/connect`;
const ICON = path.join(__dirname, 'assets', 'icon.png');

// Security suites (FortiClient, exploit protection…) kill Chromium's sandboxed
// processes when the app runs from its install folder: blank window, then the
// app closes. The app only ever shows our own site (navigation is locked to
// it below), so it runs without that sandbox.
app.commandLine.appendSwitch('no-sandbox');
// Chromium may think the window is covered by others and stop drawing it
// (blank white window); the check is unreliable with some security suites.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
// Ringtone may play without a click (the call card is not clicked yet).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId('tech.southstreet.connect');
// ssconnect://signin?code=… brings the browser's Google sign-in back to the app.
if (process.defaultApp) app.setAsDefaultProtocolClient('ssconnect', process.execPath, [path.resolve(process.argv[1] || '.')]);
else app.setAsDefaultProtocolClient('ssconnect');

const signInUrl = (argv) => {
  const link = (argv || []).find((a) => typeof a === 'string' && a.startsWith('ssconnect://signin'));
  if (!link) return null;
  try {
    const code = new URL(link).searchParams.get('code');
    return code ? `${ORIGIN}/api/auth/app-handoff?code=${encodeURIComponent(code)}` : null;
  } catch {
    return null;
  }
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let main = null;
  let card = null;
  let tray = null;
  let quitting = false;
  let call = null; // { phase, id, name, photo, role, connectedAt, muted }
  let update = null; // { version, file } — downloaded installer waiting for a quiet moment
  let updateChecking = false;
  let updateAsking = false;

  const showMain = () => {
    if (!main) return;
    if (main.isMinimized()) main.restore();
    main.show();
    main.focus();
  };

  app.on('second-instance', (_e, argv) => {
    const url = signInUrl(argv);
    if (url && main) main.loadURL(url);
    showMain();
    void checkForUpdate(); // opened again: a good moment to look for a new version
  });

  /* ---------------- self-update ---------------- */

  const UPDATE_EVERY_MS = 6 * 60 * 60 * 1000;
  const attemptFile = () => path.join(app.getPath('userData'), 'update-attempt.json');

  /** "1.10.0" > "1.9.2" */
  const isNewer = (a, b) => {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return false;
  };

  /**
   * Looks for a newer version; [force]: asked from "التحقق من التحديثات".
   * Returns { state: 'latest' | 'ready' | 'busy' | 'error', version }.
   */
  async function checkForUpdate(force = false) {
    if (!app.isPackaged) return { state: 'latest', version: app.getVersion() };
    if (updateChecking) return { state: 'busy', version: '' };
    if (update) {
      void installWhenQuiet();
      return { state: 'ready', version: update.version };
    }
    updateChecking = true;
    try {
      const res = await net.fetch(`${ORIGIN}/api/connect/app-version`, { cache: 'no-store' });
      const latest = (await res.json()).windows;
      if (!latest || !isNewer(latest.version, app.getVersion())) return { state: 'latest', version: app.getVersion() };
      // An installer that did not lead to the new version is not retried for a day (unless asked).
      try {
        const last = JSON.parse(fs.readFileSync(attemptFile(), 'utf8'));
        if (!force && last.version === latest.version && Date.now() - last.ts < 24 * 60 * 60 * 1000) return { state: 'error', version: latest.version };
      } catch {
        /* no earlier attempt */
      }
      const file = path.join(app.getPath('temp'), `SouthStreetConnect-Setup-${latest.version}.exe`);
      if (!fs.existsSync(file)) {
        // Signed-in download (the app is only for account holders): net.fetch uses the app's cookies.
        const dl = await net.fetch(new URL(latest.url, ORIGIN).href, { cache: 'no-store' });
        if (!dl.ok) return { state: 'error', version: latest.version };
        const part = `${file}.part`;
        fs.writeFileSync(part, Buffer.from(await dl.arrayBuffer()));
        fs.renameSync(part, file);
      }
      update = { version: latest.version, file };
      void installWhenQuiet();
      return { state: 'ready', version: latest.version };
    } catch {
      return { state: 'error', version: '' }; // offline: next check
    } finally {
      updateChecking = false;
    }
  }

  /** In the tray: install at once. Window open: ask once. In a call: wait for it to end. */
  async function installWhenQuiet() {
    if (!update || call || updateAsking) return;
    if (main && main.isVisible() && !main.isMinimized()) {
      updateAsking = true;
      const { response } = await dialog.showMessageBox(main, {
        type: 'info',
        title: 'South Street Connect',
        message: `تحديث جديد جاهز (${update.version})`,
        detail: 'يُغلق التطبيق لثوانٍ ثم يعود بالإصدار الجديد. حسابك ومحادثاتك تبقى كما هي.',
        buttons: ['تحديث الآن', 'لاحقاً'],
        defaultId: 0,
        cancelId: 1,
      });
      updateAsking = false;
      if (response !== 0 || call) return; // "later": asked again at the next check
    }
    runInstaller();
  }

  function runInstaller() {
    try {
      fs.writeFileSync(attemptFile(), JSON.stringify({ version: update.version, ts: Date.now() }));
      // Silent install, then the installer starts the new version (--force-run).
      spawn(update.file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
      quitting = true;
      app.quit();
    } catch {
      update = null;
    }
  }

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
        // The page learns this app's version (apps from 1.6.0 update themselves).
        additionalArguments: [`--ss-version=${app.getVersion()}`],
        contextIsolation: true,
        sandbox: false,
        // Keep the live connection and timers running while hidden in the tray.
        backgroundThrottling: false,
      },
    });
    main.loadURL(signInUrl(process.argv) || START_URL);
    // Bring the window up (and to the front) once the page has painted.
    if (!hidden) main.once('ready-to-show', showMain);

    // Only our own site is shown inside the app; anything else opens in the browser.
    main.webContents.on('will-navigate', (e, url) => {
      if (!url.startsWith(`${ORIGIN}/`) && url !== ORIGIN) {
        e.preventDefault();
        shell.openExternal(url);
      }
    });
    // If the page process still dies, show it again instead of a blank window.
    main.webContents.on('render-process-gone', (_e, details) => {
      if (details.reason !== 'clean-exit') setTimeout(() => main && main.loadURL(START_URL), 1500);
    });

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
    // Incoming call: a phone-style card in the middle of the screen. In a call
    // (main window out of sight): a small card in the bottom corner.
    const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const [w, h] = ringing ? [400, 440] : [380, 168];
    const x = ringing ? workArea.x + Math.round((workArea.width - w) / 2) : workArea.x + workArea.width - w - 16;
    const y = ringing ? workArea.y + Math.round((workArea.height - h) / 2) : workArea.y + workArea.height - h - 16;
    card.setBounds({ x, y, width: w, height: h });
    if (!card.isVisible()) {
      if (ringing) card.show(); // take focus: Enter / Esc can answer / decline
      else card.showInactive();
    }
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
      // The window itself is the card (transparent windows render as a grey
      // box on some PCs); Windows 11 rounds its corners.
      backgroundColor: '#0b1f19',
      roundedCorners: true,
      hasShadow: true,
      icon: ICON,
      webPreferences: { preload: path.join(__dirname, 'call-preload.js'), contextIsolation: true, sandbox: false },
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
    if (!call && update) setTimeout(installWhenQuiet, 3000); // the call that delayed an update is over
  });

  ipcMain.handle('ss:check-update', () => checkForUpdate(true));

  ipcMain.on('ss:open-signin', (_e, url) => {
    if (typeof url === 'string' && url.startsWith(`${ORIGIN}/`)) shell.openExternal(url);
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
    setTimeout(() => void checkForUpdate(), 8000);
    setInterval(() => void checkForUpdate(), UPDATE_EVERY_MS);
  });

  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', (e) => e.preventDefault());
}

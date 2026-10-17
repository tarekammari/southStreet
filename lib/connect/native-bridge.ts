'use client';

import { jsonAuthHeaders } from '@/lib/api-client';
import { getRingtone } from './device-prefs';

/**
 * The Connect page running inside the native apps:
 *  - Windows (Electron):  window.ssNative  — floating call card, tray, ringtone;
 *  - Android (WebView):   window.SSAndroid — push token, call screen service.
 * In a normal browser every function here does nothing.
 */
export type NativeCallState = {
  phase: string;
  id?: string;
  name?: string;
  photo?: string;
  role?: string;
  connectedAt?: number;
  muted?: boolean;
  /** Loudspeaker instead of the earpiece (Android). */
  speaker?: boolean;
  /** The ringtone picked on this device (the Windows call card plays it). */
  ringtone?: string;
};

type WindowsBridge = {
  platform: 'windows';
  callState: (s: NativeCallState | null) => void;
  onCallAction: (cb: (action: string) => void) => () => void;
};

type AndroidBridge = {
  platform: () => string;
  token: () => string;
  firebase: () => boolean;
  inForeground?: () => boolean;
  callState: (json: string) => void;
  canFullScreen: () => boolean;
  openFullScreenSettings: () => void;
  notificationsOn: () => boolean;
  openNotificationSettings: () => void;
};

const win = () => (typeof window === 'undefined' ? undefined : (window as unknown as { ssNative?: WindowsBridge }).ssNative);
const droid = () => (typeof window === 'undefined' ? undefined : (window as unknown as { SSAndroid?: AndroidBridge }).SSAndroid);

export const nativePlatform = (): 'windows' | 'android' | null => (win() ? 'windows' : droid() ? 'android' : null);

/** Android app that plays calls on the earpiece and can switch to the loudspeaker. */
export function canSwitchSpeaker(): boolean {
  try {
    return Boolean((droid() as unknown as { canSwitchSpeaker?: () => boolean } | undefined)?.canSwitchSpeaker?.());
  } catch {
    return false;
  }
}

export function sendCallState(state: NativeCallState | null) {
  const photo = state?.photo ? new URL(state.photo, window.location.href).href : undefined;
  const s = state ? { ...state, photo, ringtone: getRingtone() } : null;
  try {
    win()?.callState(s);
    droid()?.callState(JSON.stringify(s || { phase: 'ended' }));
  } catch {
    /* the app shell is optional */
  }
}

/** Buttons pressed outside the page (call card, notification): answer, decline, hangup, mute, open. */
export function onNativeCallAction(cb: (action: string) => void): () => void {
  const offWin = win()?.onCallAction(cb);
  const onEvent = (e: Event) => cb(String((e as CustomEvent).detail || ''));
  window.addEventListener('ss-native-call', onEvent);
  return () => {
    offWin?.();
    window.removeEventListener('ss-native-call', onEvent);
  };
}

/** Android: the push token, now or once Firebase hands it over. */
export function onAndroidToken(cb: (token: string) => void): () => void {
  const a = droid();
  if (!a) return () => undefined;
  try {
    const t = a.token();
    if (t) cb(t);
  } catch {
    /* ignore */
  }
  const onEvent = (e: Event) => cb(String((e as CustomEvent).detail || ''));
  window.addEventListener('ss-native-token', onEvent);
  return () => window.removeEventListener('ss-native-token', onEvent);
}

/** Android app in the background: its own call screen rings, so the page stays quiet. */
export function androidInBackground(): boolean {
  const a = droid();
  try {
    return Boolean(a?.inForeground && !a.inForeground());
  } catch {
    return false;
  }
}

export function androidChecks(): { notifications: boolean; fullScreen: boolean; firebase: boolean } | null {
  const a = droid();
  if (!a) return null;
  try {
    return { notifications: a.notificationsOn(), fullScreen: a.canFullScreen(), firebase: a.firebase() };
  } catch {
    return null;
  }
}

export const openAndroidSettings = (what: 'notifications' | 'fullscreen') => {
  const a = droid();
  if (!a) return;
  if (what === 'fullscreen') a.openFullScreenSettings();
  else a.openNotificationSettings();
};

/**
 * Inside the apps, sign-in steps the embedded browser cannot do (Google,
 * security keys) continue in the real browser, which hands the session back
 * (see /app-signin). Returns false in a normal browser.
 */
export function openSignInInBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { SSAndroid?: { openSignIn?: (u: string) => void }; ssNative?: { openSignIn?: (u: string) => void } };
  const platform = w.SSAndroid?.openSignIn ? 'android' : w.ssNative?.openSignIn ? 'windows' : null;
  if (!platform) return false;
  const url = `${window.location.origin}/app-signin?platform=${platform}`;
  if (platform === 'android') w.SSAndroid!.openSignIn!(url);
  else w.ssNative!.openSignIn!(url);
  return true;
}

export const insideNativeApp = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean((window as unknown as { SSAndroid?: unknown; ssNative?: unknown }).SSAndroid || (window as unknown as { ssNative?: unknown }).ssNative);

/* ---------- Android one-tap setup ---------- */

export type AndroidSetup = { notifications: boolean; mic: boolean; battery: boolean; fullScreen: boolean };
export type AndroidSetupStep = 'permissions' | 'battery' | 'fullscreen' | 'app';

type SetupBridge = { setupStatus?: () => string; setupStep?: (step: string) => void };

/** What is still missing for calls to ring (null outside the app, or in an app too old for the setup). */
export function androidSetupStatus(): AndroidSetup | null {
  const a = droid() as unknown as SetupBridge | undefined;
  if (!a?.setupStatus) return null;
  try {
    return JSON.parse(a.setupStatus()) as AndroidSetup;
  } catch {
    return null;
  }
}

export function androidSetupStep(step: AndroidSetupStep) {
  try {
    (droid() as unknown as SetupBridge | undefined)?.setupStep?.(step);
  } catch {
    /* ignore */
  }
}

/** The app asks the page to look again (permission answered, back from settings). */
export function onAndroidSetupChange(cb: () => void): () => void {
  window.addEventListener('ss-native-setup', cb);
  return () => window.removeEventListener('ss-native-setup', cb);
}

/* ---------- app updates ---------- */

/** First app version that updates itself; older apps get a banner from the page. */
const SELF_UPDATING = '1.6.0';

const older = (a: string, b: string) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0);
  }
  return false;
};

/** Version of the app shell around this page ('' when unknown, null in a browser). */
export function nativeVersion(): string | null {
  const w = win() as unknown as { version?: string } | undefined;
  if (w) return String(w.version || '');
  const a = droid() as unknown as { version?: () => string } | undefined;
  if (!a) return null;
  try {
    return String(a.version?.() || '');
  } catch {
    return '';
  }
}

/** An app too old to update itself: the page offers the new one. */
export function nativeNeedsManualUpdate(): boolean {
  const v = nativeVersion();
  return v !== null && (!v || older(v, SELF_UPDATING));
}

/**
 * Download the newest app in the real browser (old apps cannot download inside).
 * The browser is not signed in, so the signed-in page first gets a 15-minute link.
 */
export async function downloadNewApp() {
  const platform = nativePlatform() === 'windows' ? 'windows' : 'android';
  const res = await fetch('/api/connect/download', {
    method: 'POST',
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ platform }),
  }).catch(() => null);
  const link = res?.ok ? String((await res.json()).url || '') : '';
  const url = `${window.location.origin}${link || '/app'}`;
  const w = window as unknown as { SSAndroid?: { openSignIn?: (u: string) => void }; ssNative?: { openSignIn?: (u: string) => void } };
  const open = w.SSAndroid?.openSignIn || w.ssNative?.openSignIn;
  if (open) open(url);
  else window.open(url, '_blank');
}

export type UpdateCheck = { state: 'latest' | 'downloading' | 'ready' | 'busy' | 'error' | 'old-app' | 'web-ready'; version: string };

/** Windows (1.8.0+): how far the new version's download is, 0–100. */
export function onUpdateProgress(cb: (p: { version: string; pct: number }) => void): () => void {
  const w = win() as unknown as { onUpdateProgress?: (cb: (p: { version: string; pct: number }) => void) => () => void } | undefined;
  return w?.onUpdateProgress ? w.onUpdateProgress(cb) : () => undefined;
}

/**
 * "التحقق من التحديثات": the app shell checks itself (and shows its own
 * "update now" question when a newer version is downloaded); in a browser the
 * deployed web build is compared with the one on screen.
 */
export async function checkAppUpdate(currentWeb: string): Promise<UpdateCheck> {
  const w = win() as unknown as { checkUpdate?: () => Promise<UpdateCheck> } | undefined;
  const a = droid() as unknown as { checkUpdate?: () => void } | undefined;
  if (w || a) {
    if (nativeNeedsManualUpdate() || (w && !w.checkUpdate) || (a && !a.checkUpdate)) return { state: 'old-app', version: '' };
    if (w?.checkUpdate) {
      // Windows apps before 1.8.1 answer only when the whole download is done (minutes):
      // after a few seconds say it is downloading in the background (it asks to install when ready).
      const wait = new Promise<UpdateCheck>((resolve) => window.setTimeout(() => resolve({ state: 'downloading', version: '' }), 6000));
      return Promise.race([w.checkUpdate().catch(() => ({ state: 'error' as const, version: '' })), wait]);
    }
    return new Promise((resolve) => {
      const done = (r: UpdateCheck) => {
        window.removeEventListener('ss-native-update', onEvent);
        window.clearTimeout(timer);
        resolve(r);
      };
      const onEvent = (e: Event) => done((e as CustomEvent).detail as UpdateCheck);
      const timer = window.setTimeout(() => done({ state: 'error', version: '' }), 120_000);
      window.addEventListener('ss-native-update', onEvent);
      a!.checkUpdate!();
    });
  }
  try {
    const res = await fetch('/api/connect/app-version', { cache: 'no-store' });
    const web = String((await res.json()).web || '');
    return web && currentWeb && web !== currentWeb ? { state: 'web-ready', version: web.slice(0, 7) } : { state: 'latest', version: '' };
  } catch {
    return { state: 'error', version: '' };
  }
}

'use client';

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

export function sendCallState(state: NativeCallState | null) {
  const photo = state?.photo ? new URL(state.photo, window.location.href).href : undefined;
  const s = state ? { ...state, photo } : null;
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

'use client';

import { DEFAULT_RINGTONE, isRingtone, type RingtoneId } from './ringtones';

/** Settings kept on this device: the ringtone (like a phone's own ringtone setting) and call privacy. */

/** The ringtone picked on this device. */
const KEY = 'ss_connect_ringtone';

export function getRingtone(): RingtoneId {
  try {
    const v = localStorage.getItem(KEY);
    return isRingtone(v) ? v : DEFAULT_RINGTONE;
  } catch {
    return DEFAULT_RINGTONE;
  }
}

export function saveRingtone(id: RingtoneId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private window: the choice lasts until the page closes */
  }
  tellAndroid(id);
}

/** The Android app rings by itself while closed, so it keeps its own copy of the choice. */
export function tellAndroid(id: RingtoneId = getRingtone()) {
  try {
    (window as unknown as { SSAndroid?: { setRingtone?: (id: string) => void } }).SSAndroid?.setRingtone?.(id);
  } catch {
    /* apps before 1.6.2 ring with the original tone */
  }
}

/* ---------- call privacy ---------- */

const RELAY_KEY = 'ss_connect_relay_only';

/**
 * «إخفاء عنواني في المكالمات»: calls go only through the relay, so the other
 * side never learns this device's IP address (a little more delay).
 */
let forcedRelay = false;

/** The Super Admin made every call go through the relay (config → policy.relayOnly). */
export function setForcedRelay(on: boolean) {
  forcedRelay = on;
}

export function relayOnly(): boolean {
  if (forcedRelay) return true;
  try {
    return localStorage.getItem(RELAY_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveRelayOnly(on: boolean) {
  try {
    if (on) localStorage.setItem(RELAY_KEY, '1');
    else localStorage.removeItem(RELAY_KEY);
  } catch {
    /* ignore */
  }
}

'use client';

import { DEFAULT_RINGTONE, isRingtone, type RingtoneId } from './ringtones';

/** The ringtone picked on this device (like a phone's own ringtone setting). */
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

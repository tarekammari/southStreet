'use client';

/**
 * End-to-end protection of Connect calls.
 *
 * WebRTC always encrypts the audio between the two devices (DTLS-SRTP): the
 * relay and our server only ever carry encrypted packets. What the server could
 * still do is swap the encryption fingerprints in the call setup it passes on
 * and sit in the middle. This closes that door:
 *
 *  1. Every device has its own signing key (ECDSA P-256), made on the device;
 *     the private half cannot be exported and never leaves it (IndexedDB).
 *  2. Each side signs the fingerprint of its audio encryption in the offer /
 *     answer; the other phone checks the signature before it accepts the call,
 *     and stops the call if it does not match (tampered setup).
 *  3. Each phone remembers the keys of the people it talks to (trust on first
 *     use) and says so when a contact's key is new or changed.
 *  4. Both screens show the same 4-emoji security code, computed from both
 *     fingerprints and keys. Same emojis on both phones = nobody in the middle,
 *     not even our own server (like Signal's safety numbers / ZRTP).
 */

const DB_NAME = 'ss-connect-keys';
const STORE = 'keys';
const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const;

type Device = { privateKey: CryptoKey; publicB64: string };
let device: Promise<Device | null> | null = null;

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const subtle = () => (typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null);

function idb<T>(fn: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => open.result.close();
    };
  });
}

async function makeDevice(): Promise<Device | null> {
  const s = subtle();
  if (!s) return null;
  try {
    const saved = await idb<Device | undefined>((st) => st.get('device'), 'readonly');
    if (saved?.privateKey && saved.publicB64) return saved;
  } catch {
    /* no IndexedDB (private window): a key for this session only */
  }
  const pair = await s.generateKey(ALG, false, ['sign', 'verify']);
  const fresh: Device = { privateKey: pair.privateKey, publicB64: b64(await s.exportKey('spki', pair.publicKey)) };
  try {
    await idb((st) => st.put(fresh, 'device'), 'readwrite');
  } catch {
    /* kept in memory */
  }
  return fresh;
}

/** This device's key (made once, on first use). Null where Web Crypto is missing (non-HTTPS). */
export function deviceKey(): Promise<Device | null> {
  device ||= makeDevice().catch(() => null);
  return device;
}

/** The DTLS fingerprint of a session description ("sha-256 AB:CD:…"). */
export function fingerprintOf(sdp: string | null | undefined): string | null {
  const m = /a=fingerprint:(\S+) ([0-9A-F:]+)/i.exec(sdp || '');
  return m ? `${m[1].toLowerCase()} ${m[2].toUpperCase()}` : null;
}

const statement = (role: 'offer' | 'answer', callerId: string, calleeId: string, fp: string) => new TextEncoder().encode(`ssconnect-call-v1|${role}|${callerId}|${calleeId}|${fp}`);

/** Signs my side of the setup; empty when this device cannot sign. */
export async function signSetup(role: 'offer' | 'answer', sdp: string, callerId: string, calleeId: string): Promise<{ key?: string; sig?: string }> {
  const s = subtle();
  const fp = fingerprintOf(sdp);
  const d = await deviceKey();
  if (!s || !fp || !d) return {};
  const sig = await s.sign(SIGN, d.privateKey, statement(role, callerId, calleeId, fp));
  return { key: d.publicB64, sig: b64(sig) };
}

export type SetupCheck = 'verified' | 'unsigned' | 'invalid';

/** Checks the other side's signature over the fingerprint in their setup. */
export async function verifySetup(role: 'offer' | 'answer', sdp: string, callerId: string, calleeId: string, key?: string | null, sig?: string | null): Promise<SetupCheck> {
  const s = subtle();
  const fp = fingerprintOf(sdp);
  if (!fp) return 'invalid';
  if (!key || !sig) return 'unsigned';
  if (!s) return 'unsigned';
  try {
    const pub = await s.importKey('spki', unb64(key), ALG, false, ['verify']);
    return (await s.verify(SIGN, pub, unb64(sig), statement(role, callerId, calleeId, fp))) ? 'verified' : 'invalid';
  } catch {
    return 'invalid';
  }
}

/* ---------- the keys of the people I talk to (trust on first use) ---------- */

const PEERS = 'ss_connect_peer_keys';
export type PeerKey = 'known' | 'first' | 'new-device';

async function short(key: string): Promise<string> {
  const s = subtle();
  if (!s) return key.slice(-24);
  return b64(await s.digest('SHA-256', unb64(key))).slice(0, 22);
}

/** Remembers `key` for `peerId`: seen before, the first key of this person, or a new device of theirs. */
export async function rememberPeerKey(peerId: string, key: string | null | undefined): Promise<PeerKey | null> {
  if (!key) return null;
  const id = await short(key);
  let all: Record<string, string[]> = {};
  try {
    all = JSON.parse(localStorage.getItem(PEERS) || '{}');
  } catch {
    /* start again */
  }
  const list = all[peerId] || [];
  if (list.includes(id)) return 'known';
  all[peerId] = [id, ...list].slice(0, 6);
  try {
    localStorage.setItem(PEERS, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return list.length ? 'new-device' : 'first';
}

/* ---------- the security code both screens show ---------- */

const EMOJI = [
  '🍎', '🍋', '🍇', '🍉', '🍒', '🥝', '🌽', '🥕', '🌵', '🌴', '🌻', '🌹', '🍁', '🍄', '🌙', '⭐',
  '☀️', '⚡', '❄️', '🔥', '🌊', '⛰️', '🏝️', '🚀', '✈️', '🚲', '⛵', '🚗', '🏠', '🕌', '⏰', '🔑',
  '🎈', '🎁', '📚', '✏️', '🎵', '🎨', '⚽', '🏀', '🎯', '🧩', '💎', '👑', '🧭', '🔔', '📷', '💡',
  '🐪', '🐎', '🦁', '🐘', '🦒', '🐢', '🐬', '🐳', '🦋', '🐝', '🦉', '🦅', '🐧', '🦊', '🐱', '🐶',
];

/**
 * 4 emojis (24 bits) from both fingerprints and both device keys. The two phones
 * compute it each from what they really use, so a party in the middle shows
 * different emojis on each screen.
 */
export async function safetyCode(offerSdp: string, answerSdp: string, offerKey?: string | null, answerKey?: string | null): Promise<string[] | null> {
  const s = subtle();
  const a = fingerprintOf(offerSdp);
  const b = fingerprintOf(answerSdp);
  if (!s || !a || !b) return null;
  const bytes = new Uint8Array(await s.digest('SHA-256', new TextEncoder().encode(`ssconnect-sas-v1|${a}|${b}|${offerKey || ''}|${answerKey || ''}`)));
  const bits = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  return [18, 12, 6, 0].map((shift) => EMOJI[(bits >> shift) & 63]);
}

/**
 * Sign in on a computer by scanning a QR code with a phone that is already
 * signed in (like WhatsApp Web):
 *
 *   PC     start          → a request id (in the QR) + a poll key only the PC knows
 *   phone  scan  (signed in) → the PC shows the phone owner's name and a 2-digit number
 *   phone  approve (picks the number shown on the PC) → approved
 *   PC     poll           → gets the session once, then the request is gone
 *
 * Requests live 2 minutes, in memory (one app process), and are single use.
 * Super Admin / Admin never sign in this way: they need their security key.
 */
import crypto from 'node:crypto';

export type QrLoginStatus = 'PENDING' | 'SCANNED' | 'APPROVED' | 'DENIED';

type QrLoginRequest = {
  id: string;
  pollHash: string;
  status: QrLoginStatus;
  match: number;
  choices: number[];
  createdAt: number;
  expiresAt: number;
  device: { browser: string; os: string; ip: string };
  userId?: string;
  userName?: string;
  userAvatar?: string;
};

export const QR_LOGIN_TTL_MS = 120_000;
const MAX_STARTS_PER_IP = 30; // per 10 minutes
const g = globalThis as unknown as { __ssQrLogins?: Map<string, QrLoginRequest>; __ssQrStarts?: Map<string, number[]> };
const requests = (g.__ssQrLogins ||= new Map());
const starts = (g.__ssQrStarts ||= new Map());

const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

function sweep() {
  const now = Date.now();
  for (const [k, v] of requests) if (v.expiresAt < now) requests.delete(k);
}

/** «Chrome · Windows» from a user agent. */
export function describeDevice(userAgent: string): { browser: string; os: string } {
  const ua = String(userAgent || '');
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'متصفح';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'نظام غير معروف';
  return { browser, os };
}

export function startQrLogin(meta: { ip: string; userAgent: string }): { id: string; pollKey: string; expiresAt: number } | null {
  sweep();
  const now = Date.now();
  const recent = (starts.get(meta.ip) || []).filter((t: number) => now - t < 600_000);
  if (recent.length >= MAX_STARTS_PER_IP) return null;
  starts.set(meta.ip, [...recent, now]);

  const id = crypto.randomBytes(18).toString('base64url');
  const pollKey = crypto.randomBytes(24).toString('base64url');
  const match = crypto.randomInt(10, 100);
  const decoys = new Set<number>();
  while (decoys.size < 2) {
    const n = crypto.randomInt(10, 100);
    if (n !== match) decoys.add(n);
  }
  const choices = [match, ...decoys];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  requests.set(id, {
    id,
    pollHash: sha(pollKey),
    status: 'PENDING',
    match,
    choices,
    createdAt: now,
    expiresAt: now + QR_LOGIN_TTL_MS,
    device: { ...describeDevice(meta.userAgent), ip: meta.ip },
  });
  return { id, pollKey, expiresAt: now + QR_LOGIN_TTL_MS };
}

function live(id: string): QrLoginRequest | null {
  sweep();
  return requests.get(String(id || '')) || null;
}

/** The phone opened the link: remember who is approving and show them the computer. */
export function scanQrLogin(id: string, user: { id: string; name: string; avatar?: string }) {
  const r = live(id);
  if (!r) return { error: 'انتهت صلاحية الرمز — حدّث الرمز على الكمبيوتر وامسحه من جديد', code: 410 } as const;
  if (r.status === 'APPROVED' || r.status === 'DENIED') return { error: 'استُعمل هذا الرمز من قبل', code: 409 } as const;
  if (r.userId && r.userId !== user.id) return { error: 'مُسح هذا الرمز من حساب آخر', code: 409 } as const;
  r.status = 'SCANNED';
  r.userId = user.id;
  r.userName = user.name;
  r.userAvatar = user.avatar;
  return { device: r.device, choices: r.choices, createdAt: r.createdAt, expiresAt: r.expiresAt } as const;
}

/** The phone picked a number: the right one approves, a wrong one cancels the request. */
export function answerQrLogin(id: string, userId: string, pick: number | null): { error: string; code: number } | { status: 'APPROVED' | 'DENIED' } {
  const r = live(id);
  if (!r) return { error: 'انتهت صلاحية الرمز', code: 410 } as const;
  if (r.userId !== userId || r.status !== 'SCANNED') return { error: 'امسح الرمز من جديد', code: 409 } as const;
  const status = pick !== null && pick === r.match ? 'APPROVED' : 'DENIED';
  r.status = status;
  return { status };
}

/**
 * The computer asks where its request stands. APPROVED is handed out once:
 * the caller signs that user in and the request is deleted.
 */
export function pollQrLogin(id: string, pollKey: string):
  | { status: 'EXPIRED' }
  | { status: 'PENDING' }
  | { status: 'SCANNED'; name: string; avatar?: string; match: number }
  | { status: 'DENIED' }
  | { status: 'APPROVED'; userId: string } {
  const r = live(id);
  if (!r || !pollKey || sha(pollKey) !== r.pollHash) return { status: 'EXPIRED' };
  if (r.status === 'SCANNED') return { status: 'SCANNED', name: r.userName || '', avatar: r.userAvatar, match: r.match };
  if (r.status === 'APPROVED' && r.userId) {
    requests.delete(id);
    return { status: 'APPROVED', userId: r.userId };
  }
  if (r.status === 'DENIED') {
    requests.delete(id);
    return { status: 'DENIED' };
  }
  return { status: 'PENDING' };
}

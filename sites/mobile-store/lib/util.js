import crypto from 'node:crypto';

export const now = () => Date.now();
export const rid = (bytes = 12) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('base64url');

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}
export const fail = (status, code, message) => { throw new HttpError(status, code, message); };

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore bad cookie */ }
  }
  return out;
}

export function cookie(name, value, { maxAge, httpOnly = true, path = '/', secure = true } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=Lax`;
  if (secure) c += '; Secure';
  if (httpOnly) c += '; HttpOnly';
  if (maxAge !== undefined) c += `; Max-Age=${Math.floor(maxAge)}`;
  return c;
}

export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req, limit = 256 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try {
    const v = JSON.parse(buf.toString('utf8'));
    if (!v || typeof v !== 'object') throw new Error();
    return v;
  } catch { throw new HttpError(400, 'bad_json'); }
}

export async function readForm(req, limit = 32 * 1024) {
  const buf = await readBody(req, limit);
  return Object.fromEntries(new URLSearchParams(buf.toString('utf8')));
}

// Input cleaning: every value from the client goes through one of these.
export const str = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
export const int = (v, min = 0, max = 1e12) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};
// Money is kept in minor units (x100) as integers.
export const money = (v) => int(Math.round(Number(String(v ?? 0).replace(',', '.')) * 100), 0, 1e13);
export const oneOf = (v, list, dflt) => (list.includes(v) ? v : dflt);
export const bool = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';

export function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export const RESERVED_SLUGS = new Set(['www', 'mail', 'api', 'app', 'admin', 'static', 'cdn', 'assets', 'auth', 'login',
  'dashboard', 'store', 'stores', 'shop', 'help', 'support', 'status', 'blog', 'docs', 'billing', 'u', 'qr', 's', 'test', 'dev', 'staging', 'ns1', 'ns2', 'ftp', 'smtp', 'mobile']);

export function validSlug(s) {
  return /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(s) && !s.includes('--') && !RESERVED_SLUGS.has(s);
}

// Luhn check for IMEI (15 digits).
export function validImei(s) {
  if (!/^\d{15}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = s.charCodeAt(i) - 48;
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

export function deviceLabel(ua = '') {
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Unknown';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${br} · ${os}`;
}

// Simple in-memory fixed-window rate limiter.
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const t = now();
  let b = buckets.get(key);
  if (!b || b.reset < t) { b = { n: 0, reset: t + windowMs }; buckets.set(key, b); }
  b.n++;
  if (b.n > max) throw new HttpError(429, 'rate_limited');
}
setInterval(() => {
  const t = now();
  for (const [k, b] of buckets) if (b.reset < t) buckets.delete(k);
}, 60_000).unref();

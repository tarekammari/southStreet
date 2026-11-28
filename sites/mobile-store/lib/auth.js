import crypto from 'node:crypto';
import { config } from './config.js';
import { get, run, all, audit } from './db.js';
import { rid, sha256, now, cookie, fail, deviceLabel, rateLimit, str } from './util.js';
import { toSvg } from './qr.js';

const SESSION_COOKIE = config.secure ? '__Host-ms_sid' : 'ms_sid';
const OAUTH_COOKIE = config.secure ? '__Host-ms_oauth' : 'ms_oauth';
const SESSION_DAYS = 30;
const QR_TTL = 120_000;

// ---------- sessions ----------

export function createSession(ctx, userId, via) {
  const token = rid(32);
  const t = now();
  run('INSERT INTO sessions (id_hash, user_id, created_at, expires_at, last_seen, ua, ip, via) VALUES (?,?,?,?,?,?,?,?)',
    sha256(token), userId, t, t + SESSION_DAYS * 864e5, t, str(ctx.req.headers['user-agent'], 300), ctx.ip, via);
  run('UPDATE users SET last_login = ? WHERE id = ?', t, userId);
  ctx.setCookie(cookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86400, secure: config.secure }));
  audit(null, userId, `login_${via}`, deviceLabel(ctx.req.headers['user-agent']), ctx.ip);
}

export function loadSession(ctx) {
  const token = ctx.cookies[SESSION_COOKIE];
  if (!token || token.length > 100) return;
  const h = sha256(token);
  const s = get('SELECT * FROM sessions WHERE id_hash = ?', h);
  if (!s) return;
  const t = now();
  if (s.expires_at < t) { run('DELETE FROM sessions WHERE id_hash = ?', h); return; }
  const user = get('SELECT * FROM users WHERE id = ?', s.user_id);
  if (!user || user.disabled) return;
  // Rolling session: refresh at most once an hour.
  if (t - s.last_seen > 3600_000) {
    run('UPDATE sessions SET last_seen = ?, expires_at = ? WHERE id_hash = ?', t, t + SESSION_DAYS * 864e5, h);
  }
  if (config.superAdmins.has(user.email) && !user.is_super) {
    run('UPDATE users SET is_super = 1 WHERE id = ?', user.id); user.is_super = 1;
  }
  ctx.user = user;
  ctx.session = s;
}

export function logout(ctx) {
  if (ctx.session) run('DELETE FROM sessions WHERE id_hash = ?', ctx.session.id_hash);
  ctx.setCookie(cookie(SESSION_COOKIE, '', { maxAge: 0, secure: config.secure }));
}

export function listSessions(userId, currentHash) {
  return all('SELECT id_hash, created_at, last_seen, ua, ip, via FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen DESC', userId, now())
    .map((s) => ({ id: s.id_hash.slice(0, 16), device: deviceLabel(s.ua), ip: s.ip, via: s.via, created_at: s.created_at, last_seen: s.last_seen, current: s.id_hash === currentHash }));
}

export function revokeSession(userId, idPrefix) {
  const rows = all('SELECT id_hash FROM sessions WHERE user_id = ?', userId);
  const hit = rows.find((r) => r.id_hash.slice(0, 16) === idPrefix);
  if (hit) run('DELETE FROM sessions WHERE id_hash = ?', hit.id_hash);
  return !!hit;
}

// ---------- users ----------

export function upsertUser({ sub, email, name, picture }) {
  email = email.toLowerCase();
  const t = now();
  let user = (sub && get('SELECT * FROM users WHERE google_sub = ?', sub)) || get('SELECT * FROM users WHERE email = ?', email);
  if (!user) {
    const id = 'u_' + rid(9);
    run('INSERT INTO users (id, google_sub, email, name, picture, is_super, created_at) VALUES (?,?,?,?,?,?,?)',
      id, sub || null, email, str(name, 80), str(picture, 400), config.superAdmins.has(email) ? 1 : 0, t);
    user = get('SELECT * FROM users WHERE id = ?', id);
    audit(null, id, 'signup', email);
  } else {
    run('UPDATE users SET google_sub = COALESCE(google_sub, ?), email = ?, name = ?, picture = ?, is_super = MAX(is_super, ?) WHERE id = ?',
      sub || null, email, str(name, 80) || user.name, str(picture, 400) || user.picture, config.superAdmins.has(email) ? 1 : 0, user.id);
    user = get('SELECT * FROM users WHERE id = ?', user.id);
  }
  // Invitations sent to this e-mail become real memberships.
  run('UPDATE members SET user_id = ? WHERE email = ? AND user_id IS NULL', user.id, email);
  return user;
}

// ---------- Google OAuth (authorization code + PKCE) ----------

const sign = (v) => crypto.createHmac('sha256', config.secret).update(v).digest('base64url');
const safeNext = (n) => (typeof n === 'string' && /^\/(?!\/)[\w\-./?=&#%]*$/.test(n) ? n : '/app');
const redirectUri = () => `${config.publicUrl}/auth/google/callback`;

export function googleStart(ctx) {
  if (!config.googleClientId) fail(503, 'google_not_configured');
  rateLimit('oauth:' + ctx.ip, 30, 600_000);
  const state = rid(16), verifier = rid(32);
  const payload = Buffer.from(JSON.stringify({ s: state, v: verifier, n: safeNext(ctx.url.searchParams.get('next')), t: now() })).toString('base64url');
  ctx.setCookie(cookie(OAUTH_COOKIE, `${payload}.${sign(payload)}`, { maxAge: 600, secure: config.secure }));
  const q = new URLSearchParams({
    client_id: config.googleClientId, redirect_uri: redirectUri(), response_type: 'code', scope: 'openid email profile',
    state, code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  ctx.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
}

let jwks = { keys: [], fetched: 0 };
async function googleKey(kid) {
  if (!jwks.keys.find((k) => k.kid === kid) || now() - jwks.fetched > 6 * 3600_000) {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/certs', { signal: AbortSignal.timeout(8000) });
    if (!r.ok) fail(502, 'google_keys');
    jwks = { keys: (await r.json()).keys || [], fetched: now() };
  }
  const k = jwks.keys.find((x) => x.kid === kid);
  if (!k) fail(401, 'google_bad_key');
  return crypto.createPublicKey({ key: k, format: 'jwk' });
}

export async function verifyGoogleIdToken(idToken) {
  const [h, p, s] = String(idToken).split('.');
  if (!h || !p || !s) fail(401, 'bad_token');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  if (header.alg !== 'RS256') fail(401, 'bad_token');
  const key = await googleKey(header.kid);
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'));
  if (!ok) fail(401, 'bad_signature');
  const c = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(c.iss)) fail(401, 'bad_issuer');
  if (c.aud !== config.googleClientId) fail(401, 'bad_audience');
  if (!c.exp || c.exp * 1000 < now() - 60_000) fail(401, 'expired');
  if (!c.email || c.email_verified !== true) fail(401, 'email_not_verified');
  return c;
}

export async function googleCallback(ctx) {
  const raw = ctx.cookies[OAUTH_COOKIE] || '';
  ctx.setCookie(cookie(OAUTH_COOKIE, '', { maxAge: 0, secure: config.secure }));
  const [payload, mac] = raw.split('.');
  if (!payload || !mac || sign(payload).length !== mac.length || !crypto.timingSafeEqual(Buffer.from(sign(payload)), Buffer.from(mac))) {
    return ctx.redirect('/login?e=state');
  }
  const st = JSON.parse(Buffer.from(payload, 'base64url').toString());
  const q = ctx.url.searchParams;
  if (q.get('error') || st.s !== q.get('state') || now() - st.t > 600_000) return ctx.redirect('/login?e=cancelled');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.googleClientId, client_secret: config.googleClientSecret, code: q.get('code') || '',
      code_verifier: st.v, grant_type: 'authorization_code', redirect_uri: redirectUri(),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) return ctx.redirect('/login?e=google');
  const tok = await r.json();
  const c = await verifyGoogleIdToken(tok.id_token);
  const user = upsertUser({ sub: c.sub, email: c.email, name: c.name || c.email.split('@')[0], picture: c.picture || '' });
  if (user.disabled) return ctx.redirect('/login?e=disabled');
  createSession(ctx, user.id, 'google');
  ctx.redirect(st.n);
}

// Local testing only (DEV_LOGIN=1 and not production).
export function devLogin(ctx) {
  if (!config.devLogin) fail(404, 'not_found');
  const email = str(ctx.url.searchParams.get('email'), 120).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) fail(400, 'email');
  const user = upsertUser({ sub: null, email, name: email.split('@')[0], picture: '' });
  createSession(ctx, user.id, 'dev');
  ctx.redirect(safeNext(ctx.url.searchParams.get('next')));
}

// ---------- QR sign-in: the phone (already signed in) approves a PC ----------

export function qrStart(ctx) {
  rateLimit('qr:' + ctx.ip, 20, 600_000);
  const id = rid(12), poll = rid(24), t = now();
  const code = String(10 + crypto.randomInt(90));
  run('DELETE FROM qr_logins WHERE expires_at < ?', t - 600_000);
  run('INSERT INTO qr_logins (id, poll_hash, code, ua, ip, created_at, expires_at) VALUES (?,?,?,?,?,?,?)',
    id, sha256(poll), code, str(ctx.req.headers['user-agent'], 300), ctx.ip, t, t + QR_TTL);
  const url = `${config.publicUrl}/qr/${id}`;
  return { id, poll, code, url, svg: toSvg(url, { ecl: 'M' }), expires_in: QR_TTL / 1000 };
}

export function qrPoll(ctx) {
  const id = str(ctx.url.searchParams.get('id'), 30), poll = str(ctx.url.searchParams.get('poll'), 60);
  const q = get('SELECT * FROM qr_logins WHERE id = ?', id);
  if (!q || q.poll_hash !== sha256(poll)) fail(404, 'not_found');
  if (q.status === 'approved' && q.user_id) {
    const n = run("UPDATE qr_logins SET status = 'used' WHERE id = ? AND status = 'approved'", id);
    if (n.changes === 1) {
      createSession(ctx, q.user_id, 'qr');
      return { status: 'approved' };
    }
  }
  if (q.status === 'pending' && q.expires_at < now()) return { status: 'expired' };
  return { status: q.status === 'used' ? 'expired' : q.status };
}

export function qrInfo(id) {
  const q = get('SELECT * FROM qr_logins WHERE id = ?', id);
  if (!q || q.expires_at < now() || q.status !== 'pending') return null;
  // Three choices; the user picks the number shown on the PC (stops someone else's QR being approved by accident).
  const set = new Set([q.code]);
  const seed = crypto.createHash('sha256').update(q.id + config.secret).digest();
  for (let i = 0; set.size < 3; i++) set.add(String(10 + (seed[i % 32] + i * 37) % 90));
  const choices = [...set].sort((a, b) => (seed[Number(a) % 32] - seed[Number(b) % 32]) || a.localeCompare(b));
  return { id: q.id, device: deviceLabel(q.ua), ip: q.ip, created_at: q.created_at, choices };
}

export function qrDecide(ctx, body) {
  rateLimit('qrd:' + ctx.user.id, 20, 600_000);
  const q = get('SELECT * FROM qr_logins WHERE id = ?', str(body.id, 30));
  if (!q || q.status !== 'pending' || q.expires_at < now()) fail(410, 'qr_expired');
  if (body.deny) {
    run("UPDATE qr_logins SET status = 'denied' WHERE id = ?", q.id);
    return { ok: true, status: 'denied' };
  }
  if (String(body.code) !== q.code) {
    run("UPDATE qr_logins SET status = 'blocked' WHERE id = ?", q.id);
    audit(null, ctx.user.id, 'qr_wrong_code', deviceLabel(q.ua), ctx.ip);
    fail(400, 'qr_wrong_code');
  }
  run("UPDATE qr_logins SET status = 'approved', user_id = ? WHERE id = ? AND status = 'pending'", ctx.user.id, q.id);
  audit(null, ctx.user.id, 'qr_approved', `${deviceLabel(q.ua)} ${q.ip}`, ctx.ip);
  return { ok: true, status: 'approved' };
}

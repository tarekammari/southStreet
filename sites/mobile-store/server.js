import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from './lib/config.js';
import { openDb, get, setting, backup } from './lib/db.js';
import { HttpError, parseCookies, readJson, esc, str } from './lib/util.js';
import * as auth from './lib/auth.js';
import { storeRoutes, scope, myStores, createStore, slugCheck, uploadImage } from './lib/api-store.js';
import { adminRoutes } from './lib/api-admin.js';
import { handleStorefront, setAssets } from './lib/storefront.js';
import { uploadPath } from './lib/images.js';
import { pages } from './lib/pages.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
openDb(path.join(config.dataDir, 'mobile-store.db'));

// ---------- static files: hashed URLs, compressed once in memory ----------
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const statics = new Map();
const assets = {};
function loadStatics(dir = path.join(ROOT, 'public'), prefix = '/static') {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name), url = `${prefix}/${name}`;
    if (fs.statSync(full).isDirectory()) { loadStatics(full, url); continue; }
    const raw = fs.readFileSync(full), type = TYPES[path.extname(name)] || 'application/octet-stream';
    const hash = crypto.createHash('sha256').update(raw).digest('base64url').slice(0, 10);
    const text = /text|svg|json|manifest/.test(type);
    statics.set(url, {
      raw, type, etag: `"${hash}"`,
      br: text ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }) : null,
      gz: text ? zlib.gzipSync(raw, { level: 9 }) : null,
    });
    assets[url] = `${url}?v=${hash}`;
  }
}
loadStatics();
setAssets(assets);
if (!config.production) {
  let t;
  fs.watch(path.join(ROOT, 'public'), { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => { statics.clear(); loadStatics(); }, 150); });
}

// ---------- security headers ----------
const CSP_APP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self'; " +
  "media-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const CSP_STORE = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const BASE_HEADERS = {
  'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin', 'permissions-policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
};
if (config.secure) BASE_HEADERS['strict-transport-security'] = 'max-age=31536000';

// ---------- routing tables ----------
function compile(table) {
  return Object.entries(table).map(([key, fn]) => {
    const [method, pattern] = key.split(' ');
    const re = new RegExp('^' + pattern.split('/').map((p) => (p.startsWith(':') ? '([\\w.-]{1,40})' : p.replace(/\./g, '\\.'))).join('/') + '$');
    return { method, re, fn };
  });
}
const STORE = compile(storeRoutes), ADMIN = compile(adminRoutes);
const match = (table, method, rest) => {
  for (const r of table) { if (r.method !== method) continue; const m = rest.match(r.re); if (m) return { fn: r.fn, params: m.slice(1) }; }
  return null;
};

const SENT = Symbol('sent');

function makeCtx(req, res) {
  const url = new URL(req.url, 'http://x');
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const ip = (local && req.headers['x-real-ip']) || req.socket.remoteAddress || '';
  const cookies = parseCookies(req.headers.cookie);
  const setCookies = [];
  const ctx = {
    req, res, url, ip: String(ip).slice(0, 64), cookies, SENT,
    setCookie: (c) => setCookies.push(c),
    send(status, body, headers = {}) {
      if (res.headersSent) return;
      const h = { ...BASE_HEADERS, ...headers };
      if (setCookies.length) h['set-cookie'] = setCookies;
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
      const ae = String(req.headers['accept-encoding'] || '');
      if (buf.length > 1024 && /text|json|xml|javascript|svg/.test(h['content-type'] || '') && !h['content-encoding']) {
        h.vary = 'Accept-Encoding';
        if (ae.includes('br')) { h['content-encoding'] = 'br'; return end(status, h, zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } })); }
        if (ae.includes('gzip')) { h['content-encoding'] = 'gzip'; return end(status, h, zlib.gzipSync(buf, { level: 6 })); }
      }
      end(status, h, buf);
    },
    json(status, obj) { ctx.send(status, JSON.stringify(obj), { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); },
    redirect(to, code = 302) { ctx.send(code, '', { location: to, 'cache-control': 'no-store' }); },
  };
  function end(status, h, buf) {
    h['content-length'] = buf.length;
    res.writeHead(status, h);
    res.end(req.method === 'HEAD' ? undefined : buf);
  }
  return ctx;
}

function serveStatic(ctx, p) {
  const f = statics.get(p);
  if (!f) return ctx.send(404, 'Not found', { 'content-type': 'text/plain' });
  const versioned = ctx.url.searchParams.has('v');
  const h = { 'content-type': f.type, etag: f.etag, 'cache-control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300', vary: 'Accept-Encoding' };
  if (ctx.req.headers['if-none-match'] === f.etag) return ctx.send(304, '', h);
  const ae = String(ctx.req.headers['accept-encoding'] || '');
  if (f.br && ae.includes('br')) return ctx.send(200, f.br, { ...h, 'content-encoding': 'br' });
  if (f.gz && ae.includes('gzip')) return ctx.send(200, f.gz, { ...h, 'content-encoding': 'gzip' });
  ctx.send(200, f.raw, h);
}

function serveUpload(ctx, sid, name) {
  const p = uploadPath(sid, name);
  if (!p || !fs.existsSync(p)) return ctx.send(404, 'Not found', { 'content-type': 'text/plain' });
  ctx.send(200, fs.readFileSync(p), { 'content-type': name.endsWith('.webp') ? 'image/webp' : 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' });
}

function checkCsrf(ctx) {
  const m = ctx.req.method;
  if (m === 'GET' || m === 'HEAD') return;
  if (ctx.req.headers['x-ms'] !== '1') throw new HttpError(403, 'csrf');
  const o = ctx.req.headers.origin;
  if (o && o !== config.origin) throw new HttpError(403, 'csrf_origin');
}

async function api(ctx, p) {
  const m = ctx.req.method;
  checkCsrf(ctx);
  auth.loadSession(ctx);
  const body = () => (m === 'GET' || m === 'HEAD' ? {} : readJson(ctx.req));
  const me = () => { if (!ctx.user) throw new HttpError(401, 'auth'); };

  if (p === '/api/me' && m === 'GET') {
    return {
      user: ctx.user ? { id: ctx.user.id, email: ctx.user.email, name: ctx.user.name, picture: ctx.user.picture, is_super: !!ctx.user.is_super } : null,
      stores: ctx.user ? myStores(ctx.user) : [], announcement: setting('announcement', ''), app: config.appName, google: !!config.googleClientId, dev_login: config.devLogin,
    };
  }
  if (p === '/api/logout' && m === 'POST') { auth.logout(ctx); return { ok: true }; }
  if (p === '/api/me/sessions' && m === 'GET') { me(); return { sessions: auth.listSessions(ctx.user.id, ctx.session.id_hash) }; }
  if (p === '/api/me/sessions' && m === 'DELETE') { me(); return { ok: auth.revokeSession(ctx.user.id, str(ctx.url.searchParams.get('id'), 20)) }; }
  if (p === '/api/stores' && m === 'POST') return createStore(ctx, await body());
  if (p === '/api/slug-check' && m === 'GET') return slugCheck(ctx.url.searchParams.get('slug'));
  if (p === '/api/qr/start' && m === 'POST') return auth.qrStart(ctx);
  if (p === '/api/qr/poll' && m === 'GET') return auth.qrPoll(ctx);
  if (p === '/api/qr/approve' && m === 'POST') { me(); return auth.qrDecide(ctx, await body()); }

  let mm;
  if ((mm = p.match(/^\/api\/admin\/(.+)$/))) {
    me();
    const r = match(ADMIN, m, mm[1]);
    if (!r) throw new HttpError(404, 'not_found');
    return r.fn(ctx, r.params, await body());
  }
  if ((mm = p.match(/^\/api\/s\/(s_[\w-]{4,20})\/(.+)$/))) {
    const [, sid, rest] = mm;
    if (rest === 'uploads' && m === 'POST') return uploadImage(ctx, sid);
    const r = match(STORE, m, rest);
    if (!r) throw new HttpError(404, 'not_found');
    scope(ctx, sid, 'seller');
    return r.fn(ctx, r.params, await body());
  }
  throw new HttpError(404, 'not_found');
}

async function handle(req, res) {
  const ctx = makeCtx(req, res);
  const host = String(req.headers.host || '').toLowerCase();
  const p = ctx.url.pathname;
  try {
    if (p.startsWith('/static/')) return serveStatic(ctx, p);
    let mu;
    if ((mu = p.match(/^\/u\/(s_[\w-]{4,20})\/([\w-]{22}\.(?:webp|jpg))$/))) return serveUpload(ctx, mu[1], mu[2]);

    // A store's own subdomain.
    const suffix = '.' + config.baseHost;
    if (host !== config.baseHost && host.endsWith(suffix)) {
      const slug = host.slice(0, -suffix.length);
      if (!/^[a-z0-9-]{2,30}$/.test(slug)) return ctx.send(404, 'Not found');
      ctx.send = wrapCsp(ctx.send, CSP_STORE);
      const fwd = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) ? req.headers['x-forwarded-proto'] : '';
      const proto = fwd === 'https' || fwd === 'http' ? fwd : config.secure ? 'https' : 'http';
      const origin = `${proto}://${host}`;
      return await handleStorefront(ctx, slug, { path: '/', origin, abs: origin + '/' }, p);
    }
    if (p === '/healthz') return ctx.send(200, 'ok', { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    if (config.production && host !== config.baseHost) return ctx.send(421, 'Misdirected request', { 'content-type': 'text/plain' });
    if (p.startsWith('/api/')) {
      const out = await api(ctx, p);
      if (out !== SENT) ctx.json(200, out);
      return;
    }
    ctx.send = wrapCsp(ctx.send, CSP_APP);
    if ((mu = p.match(/^\/s\/([a-z0-9-]{2,30})(\/.*)?$/))) {
      const base = { path: `/s/${mu[1]}/`, origin: config.origin, abs: `${config.publicUrl}/s/${mu[1]}/` };
      if (!mu[2]) return ctx.redirect(base.path, 301);
      return await handleStorefront(ctx, mu[1], base, mu[2]);
    }
    if (p === '/auth/google') return auth.googleStart(ctx);
    if (p === '/auth/google/callback') return await auth.googleCallback(ctx);
    if (p === '/auth/dev') return auth.devLogin(ctx);
    auth.loadSession(ctx);
    return pages(ctx, p, assets);
  } catch (e) {
    if (e instanceof HttpError) {
      if (p.startsWith('/api/')) return ctx.json(e.status, { error: e.code, detail: e.message !== e.code ? e.message : undefined });
      return ctx.send(e.status, `<!doctype html><meta charset="utf-8"><title>${e.status}</title><p>${esc(e.code)}</p>`, { 'content-type': 'text/html; charset=utf-8' });
    }
    if (e?.code === 'ERR_SQLITE_ERROR' && /UNIQUE/.test(e.message)) return ctx.json(409, { error: 'duplicate' });
    console.error(new Date().toISOString(), req.method, p, e);
    if (!res.headersSent) ctx.json(500, { error: 'server_error' });
  }
}

function wrapCsp(send, csp) {
  return (status, body, headers = {}) => send(status, body, /html/.test(headers['content-type'] || '') ? { ...headers, 'content-security-policy': csp } : headers);
}

const server = http.createServer((req, res) => { handle(req, res); });
server.headersTimeout = 15_000;
server.requestTimeout = 60_000;
server.keepAliveTimeout = 10_000;
server.listen(config.port, config.host, () => {
  console.log(`${config.appName} on http://${config.host}:${config.port} → ${config.publicUrl}`);
});

// Daily database copy (kept 14 days).
function dailyBackup() {
  try {
    const dir = path.join(config.dataDir, 'backups');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(dir, `mobile-store-${day}.db`);
    if (!fs.existsSync(file + '.gz')) {
      backup(file);
      fs.writeFileSync(file + '.gz', zlib.gzipSync(fs.readFileSync(file)), { mode: 0o600 });
      fs.rmSync(file);
    }
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.db.gz')).sort().slice(0, -14)) fs.rmSync(path.join(dir, f));
  } catch (e) { console.error('backup failed', e); }
}
if (config.production) { setTimeout(dailyBackup, 60_000); setInterval(dailyBackup, 6 * 3600_000).unref(); }

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
export { get };

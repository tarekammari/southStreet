// End-to-end test: starts the real server on a temp database and drives it over HTTP.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3391;
const BASE = `http://localhost:${PORT}`;
let srv, dir;

class Client {
  constructor() { this.jar = {}; }
  async req(method, url, body, headers = {}) {
    const h = { 'x-ms': '1', cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; '), ...headers };
    let payload = body;
    if (body && !(body instanceof Uint8Array) && typeof body !== 'string') { payload = JSON.stringify(body); h['content-type'] = 'application/json'; }
    const r = await fetch(BASE + url, { method, headers: h, body: payload, redirect: 'manual' });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const type = r.headers.get('content-type') || '';
    return { status: r.status, headers: r.headers, body: type.includes('json') ? await r.json() : await r.text() };
  }
  async login(email) { const r = await this.req('GET', `/auth/dev?email=${encodeURIComponent(email)}&next=/app`); assert.equal(r.status, 302); }
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-test-'));
  srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
    cwd: ROOT, env: { ...process.env, PORT: String(PORT), PUBLIC_URL: BASE, DATA_DIR: dir, DEV_LOGIN: '1', SUPER_ADMIN_EMAILS: 'boss@test.local', APP_SECRET: 'x', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((res) => srv.stdout.on('data', (d) => { if (String(d).includes(' on http')) res(); }));
});
after(async () => { srv.kill(); await new Promise((r) => srv.on('exit', r)); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); });

const IMEIS = ['356938035643809', '490154203237518', '353918058126543'];

test('full store flow', async () => {
  const a = new Client();
  await a.login('owner@test.local');
  const me = await a.req('GET', '/api/me');
  assert.equal(me.body.user.email, 'owner@test.local');
  assert.equal(me.body.stores.length, 0);

  // CSRF: missing header is refused.
  const noCsrf = await fetch(`${BASE}/api/stores`, { method: 'POST', headers: { cookie: Object.entries(a.jar).map(([k, v]) => `${k}=${v}`).join('; '), 'content-type': 'application/json' }, body: '{}' });
  assert.equal(noCsrf.status, 403);

  const bad = await a.req('POST', '/api/stores', { name: 'X', slug: 'admin' });
  assert.equal(bad.status, 400);
  const st = await a.req('POST', '/api/stores', { name: 'Phone Center', slug: 'phone-center', phone: '0555123456', theme: 'night' });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  const sid = st.body.id;
  assert.equal((await a.req('GET', '/api/slug-check?slug=phone-center')).body.ok, false);

  const p = await a.req('POST', `/api/s/${sid}/products`, { kind: 'phone', brand: 'Samsung', model: 'Galaxy A55', storage: '256GB', color: 'Navy', cost: '52000', price: '61000', imeis: IMEIS.slice(0, 2) });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const pid = p.body.id;
  const acc = await a.req('POST', `/api/s/${sid}/products`, { kind: 'accessory', title: 'USB-C cable', cost: 300, price: 800, qty: 10, sku: 'CAB-01' });
  assert.equal(acc.status, 200);

  let prod = (await a.req('GET', `/api/s/${sid}/products/${pid}`)).body;
  assert.equal(prod.product.stock, 2);
  assert.equal(prod.product.title, 'Samsung Galaxy A55 256GB Navy');

  // Duplicate IMEI refused, new one accepted.
  assert.equal((await a.req('POST', `/api/s/${sid}/products/${pid}/receive`, { imeis: [IMEIS[0]] })).status, 409);
  assert.equal((await a.req('POST', `/api/s/${sid}/products/${pid}/receive`, { imeis: [IMEIS[2]], cost: 51000 })).status, 200);

  // Lookup by scanned IMEI and SKU.
  const lk = (await a.req('GET', `/api/s/${sid}/lookup?code=${IMEIS[1]}`)).body.results[0];
  assert.equal(lk.unit.imei, IMEIS[1]);
  assert.equal((await a.req('GET', `/api/s/${sid}/lookup?code=CAB-01`)).body.results[0].product.id, acc.body.id);

  // Sale: one phone (by unit) + 2 cables, partly on credit.
  const sale = await a.req('POST', `/api/s/${sid}/sales`, {
    items: [{ product_id: pid, unit_id: lk.unit.id, price: 60000 }, { product_id: acc.body.id, qty: 2 }],
    discount: 600, method: 'credit', paid: 40000, customer: { name: 'Karim', phone: '0661000000' },
  });
  assert.equal(sale.status, 200, JSON.stringify(sale.body));
  assert.equal(sale.body.number, 1);
  assert.equal(sale.body.total, (60000 + 1600 - 600) * 100);
  // Same unit cannot be sold twice.
  assert.equal((await a.req('POST', `/api/s/${sid}/sales`, { items: [{ product_id: pid, unit_id: lk.unit.id }] })).status, 409);
  // Not enough cables.
  assert.equal((await a.req('POST', `/api/s/${sid}/sales`, { items: [{ product_id: acc.body.id, qty: 99 }] })).status, 409);

  const sum = (await a.req('GET', `/api/s/${sid}/summary?tzo=0`)).body;
  assert.equal(sum.today.n, 1);
  assert.equal(sum.today.profit, (61000 - 52000 - 600) * 100); // price - unit cost - 2 cables at cost 300
  assert.equal(sum.debt, 21000 * 100);
  const cust = (await a.req('GET', `/api/s/${sid}/customers`)).body.customers[0];
  assert.equal(cust.debt, 21000 * 100);
  assert.equal((await a.req('POST', `/api/s/${sid}/customers/${cust.id}/payments`, { amount: 21000 })).status, 200);
  assert.equal((await a.req('GET', `/api/s/${sid}/customers/${cust.id}`)).body.debt, 0);

  // Refund puts the phone back in stock.
  assert.equal((await a.req('POST', `/api/s/${sid}/sales/${sale.body.id}/refund`, { reason: 'test' })).status, 200);
  prod = (await a.req('GET', `/api/s/${sid}/products/${pid}`)).body;
  assert.equal(prod.product.stock, 3);
  const rep = (await a.req('GET', `/api/s/${sid}/reports?tzo=0`)).body;
  assert.equal(rep.refunds.n, 1);

  // CSV export escapes formulas.
  const csv = await a.req('GET', `/api/s/${sid}/export/products.csv`);
  assert.equal(csv.status, 200);
  assert.match(csv.body, /Galaxy A55/);

  // ---- tenant isolation: another user cannot touch this store ----
  const b = new Client();
  await b.login('intruder@test.local');
  for (const [m, u] of [['GET', 'products'], ['GET', `products/${pid}`], ['GET', 'sales'], ['POST', 'products'], ['GET', 'summary'], ['GET', 'settings']]) {
    const r = await b.req(m, `/api/s/${sid}/${u}`, m === 'POST' ? { title: 'x' } : undefined);
    assert.equal(r.status, 403, `${m} ${u} should be forbidden`);
  }
  const bs = await b.req('POST', '/api/stores', { name: 'Other', slug: 'other-shop' });
  // b's own store cannot read a's product by id
  assert.equal((await b.req('GET', `/api/s/${bs.body.id}/products/${pid}`)).status, 404);
  assert.equal((await b.req('GET', '/api/admin/overview')).status, 403);

  // ---- staff: invite seller, seller cannot see cost or edit products ----
  assert.equal((await a.req('POST', `/api/s/${sid}/staff`, { email: 'seller@test.local', role: 'seller' })).status, 200);
  const s = new Client();
  await s.login('seller@test.local');
  const sp = (await s.req('GET', `/api/s/${sid}/products`)).body.products;
  assert.ok(sp.length >= 2);
  assert.equal(sp[0].cost, undefined);
  assert.equal((await s.req('PUT', `/api/s/${sid}/products/${pid}`, { price: 1 })).status, 403);
  assert.equal((await s.req('GET', `/api/s/${sid}/reports`)).status, 403);

  // ---- storefront by subdomain host and by path ----
  const home = await fetch(`${BASE}/s/phone-center/`);
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /Galaxy A55/);
  assert.match(html, /data-theme="night"/);
  assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);
  const viaHost = await new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: '/', headers: { host: `phone-center.localhost:${PORT}` } }, (r) => {
    let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => res(b));
  }).on('error', rej));
  assert.match(viaHost, /Phone Center/);
  const pp = await fetch(`${BASE}/s/phone-center/p/${pid}`);
  assert.match(await pp.text(), /schema.org/);

  // Public order form → appears in the store's orders.
  const ord = await fetch(`${BASE}/s/phone-center/order`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ pid, name: 'Amine', phone: '0770 11 22 33', city: 'Alger' }) });
  assert.equal(ord.status, 303);
  assert.match(ord.headers.get('location'), /ordered=1/);
  const orders = (await a.req('GET', `/api/s/${sid}/orders`)).body.orders;
  assert.equal(orders.length, 1);
  assert.equal(orders[0].name, 'Amine');

  // Uploads: junk refused, tiny real WebP accepted.
  assert.equal((await a.req('POST', `/api/s/${sid}/uploads`, new TextEncoder().encode('<svg onload=alert(1)>'), { 'content-type': 'image/webp' })).status, 415);
  const webp = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64');
  const up = await a.req('POST', `/api/s/${sid}/uploads`, new Uint8Array(webp), { 'content-type': 'image/webp' });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  const img = await fetch(`${BASE}/u/${sid}/${up.body.file}`);
  assert.equal(img.headers.get('content-type'), 'image/webp');

  // Suspended store: storefront 503, API refused for members.
  const boss = new Client();
  await boss.login('boss@test.local');
  assert.equal((await boss.req('GET', '/api/admin/overview')).status, 200);
  assert.equal((await boss.req('PUT', `/api/admin/stores/${sid}`, { status: 'suspended' })).status, 200);
  assert.equal((await fetch(`${BASE}/s/phone-center/`)).status, 503);
  assert.equal((await a.req('GET', `/api/s/${sid}/products`)).status, 403);
  await boss.req('PUT', `/api/admin/stores/${sid}`, { status: 'active' });
});

test('QR sign-in: phone approves PC with the matching number', async () => {
  const phone = new Client();
  await phone.login('qr@test.local');
  const pc = new Client();
  const start = await pc.req('POST', '/api/qr/start');
  assert.equal(start.status, 200);
  assert.match(start.body.svg, /^<svg/);
  const { id, poll, code } = start.body;
  assert.equal((await pc.req('GET', `/api/qr/poll?id=${id}&poll=${poll}`)).body.status, 'pending');
  assert.equal((await pc.req('GET', `/api/qr/poll?id=${id}&poll=wrong`)).status, 404);

  const page = await phone.req('GET', `/qr/${id}`);
  assert.equal(page.status, 200);
  assert.match(page.body, new RegExp(`data-code="${code}"`));

  // Anonymous user cannot approve.
  assert.equal((await new Client().req('POST', '/api/qr/approve', { id, code })).status, 401);
  assert.equal((await phone.req('POST', '/api/qr/approve', { id, code })).status, 200);
  const done = await pc.req('GET', `/api/qr/poll?id=${id}&poll=${poll}`);
  assert.equal(done.body.status, 'approved');
  assert.equal((await pc.req('GET', '/api/me')).body.user.email, 'qr@test.local');
  // Single use.
  assert.equal((await new Client().req('GET', `/api/qr/poll?id=${id}&poll=${poll}`)).body.status, 'expired');

  // Wrong number blocks the request.
  const s2 = (await new Client().req('POST', '/api/qr/start')).body;
  const wrong = String((Number(s2.code) % 89) + 10 === Number(s2.code) ? Number(s2.code) + 1 : (Number(s2.code) % 89) + 10);
  assert.equal((await phone.req('POST', '/api/qr/approve', { id: s2.id, code: wrong })).status, 400);
  assert.equal((await phone.req('POST', '/api/qr/approve', { id: s2.id, code: s2.code })).status, 410);
});

test('pages and static assets', async () => {
  const home = await fetch(`${BASE}/?lang=fr`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Gérez votre magasin/);
  const css = await fetch(`${BASE}/static/css/app.css?v=1`, { headers: { 'accept-encoding': 'br' } });
  assert.equal(css.headers.get('content-encoding'), 'br');
  assert.match(css.headers.get('cache-control'), /immutable/);
  assert.equal((await fetch(`${BASE}/app`, { redirect: 'manual' })).status, 302);
});

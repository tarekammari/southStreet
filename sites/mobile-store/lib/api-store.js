import { get, all, run, tx, audit } from './db.js';
import { config, PLANS, planOf, storeUrl } from './config.js';
import { rid, now, fail, str, int, money, oneOf, bool, slugify, validSlug, validImei, readBody } from './util.js';
import { saveImage, MAX_UPLOAD } from './images.js';
import { toSvg } from './qr.js';

// Every route here is under /api/s/:sid — `scope()` resolves the store from the signed-in
// user's membership and every query below filters on that store id.

const RANK = { seller: 1, manager: 2, owner: 3 };
export const THEMES = ['clean', 'night', 'souk', 'luxe'];
const KINDS = ['phone', 'tablet', 'accessory', 'part', 'other'];
const CONDITIONS = ['new', 'used', 'refurbished'];
const METHODS = ['cash', 'card', 'transfer', 'ccp', 'baridimob', 'credit'];

export function scope(ctx, sid, minRole = 'seller') {
  if (!ctx.user) fail(401, 'auth');
  const store = get('SELECT * FROM stores WHERE id = ?', sid);
  if (!store) fail(404, 'store_not_found');
  let role = get('SELECT role FROM members WHERE store_id = ? AND user_id = ?', sid, ctx.user.id)?.role;
  if (!role && ctx.user.is_super) role = 'owner';
  if (!role) fail(403, 'not_member');
  if (store.status !== 'active' && !ctx.user.is_super) fail(403, 'store_suspended');
  if (RANK[role] < RANK[minRole]) fail(403, 'forbidden');
  ctx.store = store;
  ctx.role = role;
  return store;
}
const need = (ctx, minRole) => { if (RANK[ctx.role] < RANK[minRole]) fail(403, 'forbidden'); };
const log = (ctx, action, detail) => audit(ctx.store.id, ctx.user.id, action, detail, ctx.ip);

// ---------- stores (create / list) ----------

export function myStores(user) {
  return all(`SELECT s.id, s.slug, s.name, s.logo, s.status, s.plan, s.plan_expires, s.theme, m.role
              FROM members m JOIN stores s ON s.id = m.store_id WHERE m.user_id = ? ORDER BY s.created_at`, user.id)
    .map((s) => ({ ...s, url: storeUrl(s.slug), effective_plan: planOf(s) }));
}

export function slugCheck(slug) {
  slug = slugify(slug);
  return { slug, ok: validSlug(slug) && !get('SELECT 1 FROM stores WHERE slug = ?', slug) };
}

export function createStore(ctx, b) {
  if (!ctx.user) fail(401, 'auth');
  const owned = get("SELECT COUNT(*) n FROM members WHERE user_id = ? AND role = 'owner'", ctx.user.id).n;
  if (owned >= config.maxStoresPerUser && !ctx.user.is_super) fail(403, 'store_limit');
  if (get("SELECT value FROM settings WHERE key = 'signups_open'")?.value === '0' && !ctx.user.is_super) fail(403, 'signups_closed');
  const name = str(b.name, 60);
  if (name.length < 2) fail(400, 'name_required');
  const slug = slugify(b.slug || name);
  if (!validSlug(slug)) fail(400, 'bad_slug');
  if (get('SELECT 1 FROM stores WHERE slug = ?', slug)) fail(409, 'slug_taken');
  const id = 's_' + rid(8), t = now();
  tx(() => {
    run(`INSERT INTO stores (id, slug, name, plan, plan_expires, theme, lang, phone, whatsapp, city, email, owner_id, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, slug, name, 'trial', t + config.trialDays * 864e5, oneOf(b.theme, THEMES, 'clean'), oneOf(b.lang, ['ar', 'fr', 'en'], 'ar'),
      str(b.phone, 30), str(b.phone, 30), str(b.city, 60), ctx.user.email, ctx.user.id, t, t);
    run('INSERT INTO members (store_id, email, user_id, role, created_at) VALUES (?,?,?,?,?)', id, ctx.user.email, ctx.user.id, 'owner', t);
  });
  audit(id, ctx.user.id, 'store_created', slug, ctx.ip);
  return { id, slug, url: storeUrl(slug) };
}

// ---------- helpers ----------

function productOut(p) {
  let images = [];
  try { images = JSON.parse(p.images); } catch { /* keep empty */ }
  const stock = p.track_imei ? p.units_in ?? 0 : p.qty;
  return { ...p, images, stock, units_in: undefined };
}

function loadProduct(ctx, pid) {
  const p = get(`SELECT p.*, (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id AND u.status = 'in_stock') units_in
                 FROM products p WHERE p.id = ? AND p.store_id = ?`, pid, ctx.store.id);
  if (!p) fail(404, 'product_not_found');
  return p;
}

function cleanImages(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 8).map((i) => ({
    f: /^[\w-]{22}\.(webp|jpg)$/.test(i?.f) ? i.f : null,
    t: /^[\w-]{22}\.(webp|jpg)$/.test(i?.t) ? i.t : null,
    w: int(i?.w, 0, 4096), h: int(i?.h, 0, 4096),
  })).filter((i) => i.f);
}

function productFields(b) {
  const kind = oneOf(b.kind, KINDS, 'phone');
  const brand = str(b.brand, 40), model = str(b.model, 60);
  const storage = str(b.storage, 20), ram = str(b.ram, 20), color = str(b.color, 30);
  const title = str(b.title, 120) || [brand, model, storage, color].filter(Boolean).join(' ');
  if (!title) fail(400, 'title_required');
  return {
    kind, brand, model, title, storage, ram, color,
    condition: oneOf(b.condition, CONDITIONS, 'new'),
    battery: b.battery === '' || b.battery == null ? null : int(b.battery, 0, 100),
    warranty: str(b.warranty, 60), sku: str(b.sku, 60),
    cost: money(b.cost), price: money(b.price), old_price: money(b.old_price),
    track_imei: b.track_imei === undefined ? (kind === 'phone' || kind === 'tablet' ? 1 : 0) : (bool(b.track_imei) ? 1 : 0),
    description: str(b.description, 4000), images: JSON.stringify(cleanImages(b.images)),
    published: b.published === undefined ? 1 : (bool(b.published) ? 1 : 0), featured: bool(b.featured) ? 1 : 0,
  };
}

function dayBounds(tzo) {
  const off = int(tzo, -900, 900) * 60_000;
  const t = now();
  const today = Math.floor((t - off) / 864e5) * 864e5 + off;
  return { off, today, t };
}

function findOrCreateCustomer(ctx, c) {
  if (!c) return null;
  if (c.id) {
    const row = get('SELECT * FROM customers WHERE id = ? AND store_id = ?', str(c.id, 30), ctx.store.id);
    if (!row) fail(404, 'customer_not_found');
    return row;
  }
  const name = str(c.name, 80), phone = str(c.phone, 30);
  if (!name && !phone) return null;
  if (phone) {
    const row = get('SELECT * FROM customers WHERE store_id = ? AND phone = ?', ctx.store.id, phone);
    if (row) return row;
  }
  const id = 'c_' + rid(8);
  run('INSERT INTO customers (id, store_id, name, phone, created_at) VALUES (?,?,?,?,?)', id, ctx.store.id, name || phone, phone, now());
  return get('SELECT * FROM customers WHERE id = ?', id);
}

// ---------- handlers ----------

export const storeRoutes = {
  // Dashboard numbers
  'GET summary': (ctx) => {
    const s = ctx.store.id, { off, today } = dayBounds(ctx.url.searchParams.get('tzo'));
    const month = today - 29 * 864e5;
    const agg = (from) => get(`SELECT COUNT(*) n, COALESCE(SUM(total),0) total, COALESCE(SUM(total - cost),0) profit
                               FROM sales WHERE store_id = ? AND status = 'done' AND created_at >= ?`, s, from);
    const days = all(`SELECT CAST((created_at - ?) / 86400000 AS INTEGER) d, SUM(total) total, SUM(total - cost) profit, COUNT(*) n
                      FROM sales WHERE store_id = ? AND status = 'done' AND created_at >= ? GROUP BY d ORDER BY d`, off, s, month);
    const stock = get(`SELECT
        (SELECT COUNT(*) FROM units WHERE store_id = ? AND status = 'in_stock') + (SELECT COALESCE(SUM(qty),0) FROM products WHERE store_id = ? AND track_imei = 0 AND archived = 0) items,
        (SELECT COALESCE(SUM(cost),0) FROM units WHERE store_id = ? AND status = 'in_stock') + (SELECT COALESCE(SUM(qty * cost),0) FROM products WHERE store_id = ? AND track_imei = 0 AND archived = 0 AND qty > 0) value,
        (SELECT COUNT(*) FROM products WHERE store_id = ? AND archived = 0) products`, s, s, s, s, s);
    const low = all(`SELECT * FROM (SELECT p.id, p.title, p.images, CASE WHEN p.track_imei = 1 THEN (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id AND u.status = 'in_stock') ELSE p.qty END stock
                     FROM products p WHERE p.store_id = ? AND p.archived = 0) WHERE stock <= ? ORDER BY stock LIMIT 8`, s, ctx.store.low_stock)
      .map((p) => ({ ...p, images: JSON.parse(p.images) }));
    const top = all(`SELECT i.product_id id, i.title, SUM(i.qty) qty, SUM(i.price * i.qty) total FROM sale_items i JOIN sales x ON x.id = i.sale_id
                     WHERE i.store_id = ? AND x.status = 'done' AND x.created_at >= ? GROUP BY i.product_id ORDER BY qty DESC LIMIT 5`, s, month);
    const recent = all(`SELECT id, number, total, method, customer_name, status, created_at FROM sales WHERE store_id = ? ORDER BY created_at DESC LIMIT 6`, s);
    const orders = get("SELECT COUNT(*) n FROM orders WHERE store_id = ? AND status = 'new'", s).n;
    const debt = get(`SELECT COALESCE((SELECT SUM(total - paid) FROM sales WHERE store_id = ? AND status = 'done'),0) - COALESCE((SELECT SUM(amount) FROM payments WHERE store_id = ?),0) v`, s, s).v;
    const showProfit = RANK[ctx.role] >= RANK.manager;
    const strip = (a) => (showProfit ? a : { ...a, profit: undefined });
    return {
      today: strip(agg(today)), month: strip(agg(month)), stock: showProfit ? stock : { ...stock, value: undefined },
      days: days.map((d) => ({ day: d.d * 864e5 + off, total: d.total, n: d.n, profit: showProfit ? d.profit : undefined })),
      low, top, recent, orders, debt: showProfit ? debt : undefined,
    };
  },

  // ----- products -----
  'GET products': (ctx) => {
    const q = ctx.url.searchParams;
    const where = ['p.store_id = ?', 'p.archived = ?'];
    const args = [ctx.store.id, q.get('archived') === '1' ? 1 : 0];
    const text = str(q.get('q'), 60);
    if (text) {
      where.push(`(p.title LIKE ? OR p.brand LIKE ? OR p.model LIKE ? OR p.sku = ? OR EXISTS (SELECT 1 FROM units u WHERE u.product_id = p.id AND (u.imei = ? OR u.imei2 = ?)))`);
      const like = `%${text.replace(/[%_]/g, '')}%`;
      args.push(like, like, like, text, text, text);
    }
    const kind = q.get('kind');
    if (KINDS.includes(kind)) { where.push('p.kind = ?'); args.push(kind); }
    const brand = str(q.get('brand'), 40);
    if (brand) { where.push('p.brand = ?'); args.push(brand); }
    const rows = all(`SELECT p.*, (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id AND u.status = 'in_stock') units_in
                      FROM products p WHERE ${where.join(' AND ')} ORDER BY p.updated_at DESC LIMIT 1000`, ...args).map(productOut);
    const brands = all("SELECT DISTINCT brand FROM products WHERE store_id = ? AND brand != '' AND archived = 0 ORDER BY brand", ctx.store.id).map((r) => r.brand);
    const stockFilter = q.get('stock');
    const list = stockFilter === 'low' ? rows.filter((p) => p.stock <= ctx.store.low_stock)
      : stockFilter === 'out' ? rows.filter((p) => p.stock <= 0) : rows;
    return { products: RANK[ctx.role] >= RANK.manager ? list : list.map((p) => ({ ...p, cost: undefined })), brands };
  },

  'GET products/:id': (ctx, [pid]) => {
    const p = productOut(loadProduct(ctx, pid));
    const units = all(`SELECT u.*, s.name supplier FROM units u LEFT JOIN suppliers s ON s.id = u.supplier_id
                       WHERE u.product_id = ? AND u.store_id = ? ORDER BY u.status = 'in_stock' DESC, u.created_at DESC LIMIT 500`, pid, ctx.store.id);
    const moves = all('SELECT m.*, u.imei FROM stock_moves m LEFT JOIN units u ON u.id = m.unit_id WHERE m.product_id = ? AND m.store_id = ? ORDER BY m.created_at DESC LIMIT 100', pid, ctx.store.id);
    const manager = RANK[ctx.role] >= RANK.manager;
    return { product: manager ? p : { ...p, cost: undefined }, units: manager ? units : units.map((u) => ({ ...u, cost: undefined })), moves };
  },

  'POST products': (ctx, _, b) => {
    need(ctx, 'manager');
    const limit = PLANS[planOf(ctx.store)].products;
    if (get('SELECT COUNT(*) n FROM products WHERE store_id = ? AND archived = 0', ctx.store.id).n >= limit) fail(403, 'plan_product_limit');
    const f = productFields(b), id = 'p_' + rid(8), t = now();
    run(`INSERT INTO products (id, store_id, kind, brand, model, title, storage, ram, color, condition, battery, warranty, sku, cost, price, old_price,
         track_imei, qty, description, images, published, featured, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, ctx.store.id, f.kind, f.brand, f.model, f.title, f.storage, f.ram, f.color, f.condition, f.battery, f.warranty, f.sku, f.cost, f.price, f.old_price,
      f.track_imei, 0, f.description, f.images, f.published, f.featured, t, t);
    log(ctx, 'product_created', f.title);
    // Optional opening stock straight from the "new product" form.
    if ((Array.isArray(b.imeis) && b.imeis.length) || int(b.qty) > 0) receive(ctx, id, { imeis: b.imeis, qty: b.qty, cost: b.cost, supplier_id: b.supplier_id });
    return { id };
  },

  'PUT products/:id': (ctx, [pid], b) => {
    need(ctx, 'manager');
    const old = loadProduct(ctx, pid);
    const f = productFields({ ...old, images: JSON.parse(old.images), ...b });
    run(`UPDATE products SET kind=?, brand=?, model=?, title=?, storage=?, ram=?, color=?, condition=?, battery=?, warranty=?, sku=?, cost=?, price=?, old_price=?,
         track_imei=?, description=?, images=?, published=?, featured=?, updated_at=? WHERE id = ? AND store_id = ?`,
      f.kind, f.brand, f.model, f.title, f.storage, f.ram, f.color, f.condition, f.battery, f.warranty, f.sku, f.cost, f.price, f.old_price,
      old.track_imei, f.description, f.images, f.published, f.featured, now(), pid, ctx.store.id);
    if (old.price !== f.price) log(ctx, 'price_changed', `${f.title}: ${old.price / 100} → ${f.price / 100}`);
    return { ok: true };
  },

  'POST products/:id/archive': (ctx, [pid], b) => {
    need(ctx, 'manager');
    loadProduct(ctx, pid);
    run('UPDATE products SET archived = ?, updated_at = ? WHERE id = ? AND store_id = ?', bool(b.archived) ? 1 : 0, now(), pid, ctx.store.id);
    log(ctx, bool(b.archived) ? 'product_archived' : 'product_restored', pid);
    return { ok: true };
  },

  'DELETE products/:id': (ctx, [pid]) => {
    need(ctx, 'owner');
    const p = loadProduct(ctx, pid);
    if (get('SELECT 1 FROM sale_items WHERE product_id = ? AND store_id = ? LIMIT 1', pid, ctx.store.id)) fail(409, 'product_has_sales');
    tx(() => {
      run('DELETE FROM units WHERE product_id = ? AND store_id = ?', pid, ctx.store.id);
      run('DELETE FROM stock_moves WHERE product_id = ? AND store_id = ?', pid, ctx.store.id);
      run('DELETE FROM products WHERE id = ? AND store_id = ?', pid, ctx.store.id);
    });
    log(ctx, 'product_deleted', p.title);
    return { ok: true };
  },

  // ----- stock -----
  'POST products/:id/receive': (ctx, [pid], b) => { need(ctx, 'manager'); return receive(ctx, pid, b); },

  'POST products/:id/adjust': (ctx, [pid], b) => {
    need(ctx, 'manager');
    const p = loadProduct(ctx, pid);
    if (p.track_imei) fail(400, 'use_units');
    const delta = int(b.delta, -100000, 100000);
    if (!delta) fail(400, 'qty_required');
    if (p.qty + delta < 0) fail(400, 'not_enough_stock');
    tx(() => {
      run('UPDATE products SET qty = qty + ?, updated_at = ? WHERE id = ?', delta, now(), pid);
      run('INSERT INTO stock_moves (id, store_id, product_id, type, qty, cost, note, user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        'm_' + rid(8), ctx.store.id, pid, 'adjust', delta, p.cost, str(b.note, 200), ctx.user.id, now());
    });
    return { ok: true };
  },

  'PUT units/:id': (ctx, [uid], b) => {
    need(ctx, 'manager');
    const u = get('SELECT * FROM units WHERE id = ? AND store_id = ?', uid, ctx.store.id);
    if (!u) fail(404, 'unit_not_found');
    const status = b.status ? oneOf(b.status, ['in_stock', 'defective', 'reserved'], u.status) : u.status;
    if (u.status === 'sold' && b.status) fail(400, 'unit_sold');
    const imei = b.imei ? str(b.imei, 20).replace(/\s/g, '') : u.imei;
    if (imei !== u.imei && get('SELECT 1 FROM units WHERE store_id = ? AND imei = ? AND id != ?', ctx.store.id, imei, uid)) fail(409, 'imei_exists');
    run('UPDATE units SET imei = ?, imei2 = ?, status = ?, note = ?, cost = ?, updated_at = ? WHERE id = ?',
      imei, b.imei2 !== undefined ? str(b.imei2, 20) : u.imei2, status, b.note !== undefined ? str(b.note, 200) : u.note,
      b.cost !== undefined ? money(b.cost) : u.cost, now(), uid);
    if (status !== u.status) {
      run('INSERT INTO stock_moves (id, store_id, product_id, unit_id, type, qty, note, user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        'm_' + rid(8), ctx.store.id, u.product_id, uid, 'status', status === 'in_stock' ? 1 : -1, status, ctx.user.id, now());
    }
    return { ok: true };
  },

  'DELETE units/:id': (ctx, [uid]) => {
    need(ctx, 'manager');
    const u = get('SELECT * FROM units WHERE id = ? AND store_id = ?', uid, ctx.store.id);
    if (!u) fail(404, 'unit_not_found');
    if (u.status === 'sold' || u.sale_id) fail(409, 'unit_sold');
    tx(() => {
      run('DELETE FROM units WHERE id = ?', uid);
      run('INSERT INTO stock_moves (id, store_id, product_id, type, qty, cost, note, user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        'm_' + rid(8), ctx.store.id, u.product_id, 'out', -1, u.cost, `IMEI ${u.imei} removed`, ctx.user.id, now());
    });
    log(ctx, 'unit_removed', u.imei);
    return { ok: true };
  },

  'GET moves': (ctx) => {
    const rows = all(`SELECT m.*, p.title, u.imei, s.name supplier FROM stock_moves m JOIN products p ON p.id = m.product_id
                      LEFT JOIN units u ON u.id = m.unit_id LEFT JOIN suppliers s ON s.id = m.supplier_id
                      WHERE m.store_id = ? ORDER BY m.created_at DESC LIMIT 300`, ctx.store.id);
    return { moves: RANK[ctx.role] >= RANK.manager ? rows : rows.map((m) => ({ ...m, cost: undefined })) };
  },

  // POS lookup by scanned IMEI / barcode / SKU.
  'GET lookup': (ctx) => {
    const code = str(ctx.url.searchParams.get('code'), 60).replace(/\s/g, '');
    if (!code) return { results: [] };
    const unit = get(`SELECT u.id unit_id, u.imei, u.status, p.* , u.cost unit_cost FROM units u JOIN products p ON p.id = u.product_id
                      WHERE u.store_id = ? AND (u.imei = ? OR u.imei2 = ?)`, ctx.store.id, code, code);
    if (unit) return { results: [{ product: productOut({ ...unit, units_in: 0 }), unit: { id: unit.unit_id, imei: unit.imei, status: unit.status } }] };
    const ps = all(`SELECT p.*, (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id AND u.status = 'in_stock') units_in FROM products p
                    WHERE p.store_id = ? AND p.archived = 0 AND p.sku = ?`, ctx.store.id, code);
    return { results: ps.map((p) => ({ product: productOut(p) })) };
  },

  'GET products/:id/units': (ctx, [pid]) => {
    loadProduct(ctx, pid);
    return { units: all("SELECT id, imei, imei2, note FROM units WHERE product_id = ? AND store_id = ? AND status = 'in_stock' ORDER BY created_at", pid, ctx.store.id) };
  },

  // ----- sales -----
  'POST sales': (ctx, _, b) => createSale(ctx, b),

  'GET sales': (ctx) => {
    const q = ctx.url.searchParams;
    const where = ['x.store_id = ?'], args = [ctx.store.id];
    const from = int(q.get('from'), 0), to = int(q.get('to'), 0);
    if (from) { where.push('x.created_at >= ?'); args.push(from); }
    if (to) { where.push('x.created_at < ?'); args.push(to); }
    const text = str(q.get('q'), 60);
    if (text) {
      where.push(`(x.customer_name LIKE ? OR x.customer_phone LIKE ? OR CAST(x.number AS TEXT) = ? OR EXISTS (SELECT 1 FROM sale_items i WHERE i.sale_id = x.id AND (i.imei = ? OR i.title LIKE ?)))`);
      const like = `%${text.replace(/[%_]/g, '')}%`;
      args.push(like, like, text, text, like);
    }
    const rows = all(`SELECT x.*, us.name seller, (SELECT GROUP_CONCAT(title, ' + ') FROM sale_items WHERE sale_id = x.id) items
                      FROM sales x LEFT JOIN users us ON us.id = x.user_id WHERE ${where.join(' AND ')} ORDER BY x.created_at DESC LIMIT 500`, ...args);
    const manager = RANK[ctx.role] >= RANK.manager;
    return { sales: manager ? rows : rows.map((r) => ({ ...r, cost: undefined })) };
  },

  'GET sales/:id': (ctx, [id]) => {
    const sale = get('SELECT x.*, us.name seller FROM sales x LEFT JOIN users us ON us.id = x.user_id WHERE x.id = ? AND x.store_id = ?', id, ctx.store.id);
    if (!sale) fail(404, 'sale_not_found');
    const items = all('SELECT * FROM sale_items WHERE sale_id = ? AND store_id = ?', id, ctx.store.id);
    const manager = RANK[ctx.role] >= RANK.manager;
    return { sale: manager ? sale : { ...sale, cost: undefined }, items: manager ? items : items.map((i) => ({ ...i, cost: undefined })) };
  },

  'POST sales/:id/refund': (ctx, [id], b) => {
    need(ctx, 'manager');
    const sale = get('SELECT * FROM sales WHERE id = ? AND store_id = ?', id, ctx.store.id);
    if (!sale) fail(404, 'sale_not_found');
    if (sale.status !== 'done') fail(409, 'already_refunded');
    const items = all('SELECT * FROM sale_items WHERE sale_id = ?', id);
    tx(() => {
      run("UPDATE sales SET status = 'refunded', note = TRIM(note || ' ' || ?) WHERE id = ?", str(b.reason, 200), id);
      for (const i of items) {
        if (i.unit_id) run("UPDATE units SET status = 'in_stock', sale_id = NULL, updated_at = ? WHERE id = ? AND store_id = ?", now(), i.unit_id, ctx.store.id);
        else run('UPDATE products SET qty = qty + ?, updated_at = ? WHERE id = ? AND store_id = ?', i.qty, now(), i.product_id, ctx.store.id);
        run('INSERT INTO stock_moves (id, store_id, product_id, unit_id, type, qty, cost, sale_id, note, user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          'm_' + rid(8), ctx.store.id, i.product_id, i.unit_id, 'return', i.qty, i.cost, id, str(b.reason, 200), ctx.user.id, now());
      }
    });
    log(ctx, 'sale_refunded', `#${sale.number}`);
    return { ok: true };
  },

  // ----- customers -----
  'GET customers': (ctx) => {
    const text = str(ctx.url.searchParams.get('q'), 60);
    const like = `%${text.replace(/[%_]/g, '')}%`;
    const rows = all(`SELECT c.*,
        (SELECT COUNT(*) FROM sales x WHERE x.customer_id = c.id AND x.status = 'done') sales,
        (SELECT COALESCE(SUM(total),0) FROM sales x WHERE x.customer_id = c.id AND x.status = 'done') spent,
        (SELECT COALESCE(SUM(total - paid),0) FROM sales x WHERE x.customer_id = c.id AND x.status = 'done') - (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.customer_id = c.id) debt
      FROM customers c WHERE c.store_id = ? ${text ? 'AND (c.name LIKE ? OR c.phone LIKE ?)' : ''} ORDER BY c.created_at DESC LIMIT 500`,
    ...(text ? [ctx.store.id, like, like] : [ctx.store.id]));
    return { customers: rows };
  },
  'POST customers': (ctx, _, b) => {
    const name = str(b.name, 80);
    if (!name) fail(400, 'name_required');
    const id = 'c_' + rid(8);
    run('INSERT INTO customers (id, store_id, name, phone, note, created_at) VALUES (?,?,?,?,?,?)', id, ctx.store.id, name, str(b.phone, 30), str(b.note, 300), now());
    return { id };
  },
  'PUT customers/:id': (ctx, [id], b) => {
    const r = run('UPDATE customers SET name = ?, phone = ?, note = ? WHERE id = ? AND store_id = ?', str(b.name, 80), str(b.phone, 30), str(b.note, 300), id, ctx.store.id);
    if (!r.changes) fail(404, 'customer_not_found');
    return { ok: true };
  },
  'GET customers/:id': (ctx, [id]) => {
    const c = get('SELECT * FROM customers WHERE id = ? AND store_id = ?', id, ctx.store.id);
    if (!c) fail(404, 'customer_not_found');
    const sales = all('SELECT id, number, total, paid, status, created_at, (SELECT GROUP_CONCAT(title, \' + \') FROM sale_items WHERE sale_id = sales.id) items FROM sales WHERE customer_id = ? AND store_id = ? ORDER BY created_at DESC', id, ctx.store.id);
    const payments = all('SELECT * FROM payments WHERE customer_id = ? AND store_id = ? ORDER BY created_at DESC', id, ctx.store.id);
    const debt = sales.filter((x) => x.status === 'done').reduce((a, x) => a + x.total - x.paid, 0) - payments.reduce((a, p) => a + p.amount, 0);
    return { customer: c, sales, payments, debt };
  },
  'POST customers/:id/payments': (ctx, [id], b) => {
    if (!get('SELECT 1 FROM customers WHERE id = ? AND store_id = ?', id, ctx.store.id)) fail(404, 'customer_not_found');
    const amount = money(b.amount);
    if (!amount) fail(400, 'amount_required');
    run('INSERT INTO payments (id, store_id, customer_id, amount, note, user_id, created_at) VALUES (?,?,?,?,?,?,?)', 'pay_' + rid(8), ctx.store.id, id, amount, str(b.note, 200), ctx.user.id, now());
    log(ctx, 'debt_payment', `${id} ${amount / 100}`);
    return { ok: true };
  },

  // ----- suppliers -----
  'GET suppliers': (ctx) => ({
    suppliers: all(`SELECT s.*, (SELECT COUNT(*) FROM units u WHERE u.supplier_id = s.id) units,
                    (SELECT COALESCE(SUM(m.cost * m.qty),0) FROM stock_moves m WHERE m.supplier_id = s.id AND m.type = 'in') bought
                    FROM suppliers s WHERE s.store_id = ? ORDER BY s.name`, ctx.store.id),
  }),
  'POST suppliers': (ctx, _, b) => {
    need(ctx, 'manager');
    const name = str(b.name, 80);
    if (!name) fail(400, 'name_required');
    const id = 'sup_' + rid(8);
    run('INSERT INTO suppliers (id, store_id, name, phone, note, created_at) VALUES (?,?,?,?,?,?)', id, ctx.store.id, name, str(b.phone, 30), str(b.note, 300), now());
    return { id };
  },
  'PUT suppliers/:id': (ctx, [id], b) => {
    need(ctx, 'manager');
    run('UPDATE suppliers SET name = ?, phone = ?, note = ? WHERE id = ? AND store_id = ?', str(b.name, 80), str(b.phone, 30), str(b.note, 300), id, ctx.store.id);
    return { ok: true };
  },
  'DELETE suppliers/:id': (ctx, [id]) => {
    need(ctx, 'manager');
    run('UPDATE units SET supplier_id = NULL WHERE supplier_id = ? AND store_id = ?', id, ctx.store.id);
    run('DELETE FROM suppliers WHERE id = ? AND store_id = ?', id, ctx.store.id);
    return { ok: true };
  },

  // ----- online orders from the storefront -----
  'GET orders': (ctx) => {
    const st = ctx.url.searchParams.get('status');
    const rows = ['new', 'confirmed', 'done', 'cancelled'].includes(st)
      ? all('SELECT * FROM orders WHERE store_id = ? AND status = ? ORDER BY created_at DESC LIMIT 300', ctx.store.id, st)
      : all('SELECT * FROM orders WHERE store_id = ? ORDER BY created_at DESC LIMIT 300', ctx.store.id);
    return { orders: rows.map(({ ip_hash, ...o }) => o) };
  },
  'PUT orders/:id': (ctx, [id], b) => {
    const status = oneOf(b.status, ['new', 'confirmed', 'done', 'cancelled'], null);
    if (!status) fail(400, 'bad_status');
    const r = run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND store_id = ?', status, now(), id, ctx.store.id);
    if (!r.changes) fail(404, 'order_not_found');
    return { ok: true };
  },

  // ----- expenses -----
  'GET expenses': (ctx) => {
    need(ctx, 'manager');
    return { expenses: all('SELECT e.*, u.name by_name FROM expenses e LEFT JOIN users u ON u.id = e.user_id WHERE e.store_id = ? ORDER BY e.created_at DESC LIMIT 300', ctx.store.id) };
  },
  'POST expenses': (ctx, _, b) => {
    need(ctx, 'manager');
    const label = str(b.label, 120), amount = money(b.amount);
    if (!label || !amount) fail(400, 'fields_required');
    run('INSERT INTO expenses (id, store_id, label, amount, user_id, created_at) VALUES (?,?,?,?,?,?)', 'e_' + rid(8), ctx.store.id, label, amount, ctx.user.id, now());
    return { ok: true };
  },
  'DELETE expenses/:id': (ctx, [id]) => {
    need(ctx, 'owner');
    run('DELETE FROM expenses WHERE id = ? AND store_id = ?', id, ctx.store.id);
    return { ok: true };
  },

  // ----- reports -----
  'GET reports': (ctx) => {
    need(ctx, 'manager');
    const q = ctx.url.searchParams, s = ctx.store.id;
    const off = int(q.get('tzo'), -900, 900) * 60_000;
    const to = int(q.get('to'), 0) || now(), from = int(q.get('from'), 0) || to - 30 * 864e5;
    const base = "FROM sales WHERE store_id = ? AND status = 'done' AND created_at >= ? AND created_at < ?";
    const totals = get(`SELECT COUNT(*) n, COALESCE(SUM(total),0) total, COALESCE(SUM(cost),0) cost, COALESCE(SUM(discount),0) discount, COALESCE(SUM(total - paid),0) unpaid ${base}`, s, from, to);
    const refunds = get("SELECT COUNT(*) n, COALESCE(SUM(total),0) total FROM sales WHERE store_id = ? AND status = 'refunded' AND created_at >= ? AND created_at < ?", s, from, to);
    const expenses = get('SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE store_id = ? AND created_at >= ? AND created_at < ?', s, from, to).v;
    const days = all(`SELECT CAST((created_at - ?) / 86400000 AS INTEGER) d, SUM(total) total, SUM(total - cost) profit, COUNT(*) n ${base} GROUP BY d ORDER BY d`, off, s, from, to)
      .map((d) => ({ day: d.d * 864e5 + off, total: d.total, profit: d.profit, n: d.n }));
    const methods = all(`SELECT method, COUNT(*) n, SUM(total) total ${base} GROUP BY method ORDER BY total DESC`, s, from, to);
    const sellers = all(`SELECT COALESCE(u.name, '?') name, COUNT(*) n, SUM(x.total) total, SUM(x.total - x.cost) profit FROM sales x LEFT JOIN users u ON u.id = x.user_id
                         WHERE x.store_id = ? AND x.status = 'done' AND x.created_at >= ? AND x.created_at < ? GROUP BY x.user_id ORDER BY total DESC`, s, from, to);
    const products = all(`SELECT i.title, SUM(i.qty) qty, SUM(i.price * i.qty) total, SUM((i.price - i.cost) * i.qty) profit FROM sale_items i JOIN sales x ON x.id = i.sale_id
                          WHERE i.store_id = ? AND x.status = 'done' AND x.created_at >= ? AND x.created_at < ? GROUP BY i.product_id ORDER BY total DESC LIMIT 20`, s, from, to);
    const brands = all(`SELECT COALESCE(NULLIF(p.brand, ''), '—') brand, SUM(i.qty) qty, SUM(i.price * i.qty) total FROM sale_items i JOIN sales x ON x.id = i.sale_id
                        LEFT JOIN products p ON p.id = i.product_id WHERE i.store_id = ? AND x.status = 'done' AND x.created_at >= ? AND x.created_at < ?
                        GROUP BY brand ORDER BY total DESC LIMIT 12`, s, from, to);
    const profit = totals.total - totals.cost;
    return { from, to, totals: { ...totals, profit, expenses, net: profit - expenses }, refunds, days, methods, sellers, products, brands };
  },

  'GET export/:what': (ctx, [what]) => {
    need(ctx, 'manager');
    const csv = (rows, cols) => '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => {
      const v = r[c] ?? '';
      const s = /price|cost|total|paid|discount/.test(c) && typeof v === 'number' ? (v / 100).toFixed(2) : String(v);
      return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s;
    }).join(','))].join('\n');
    let body;
    if (what === 'products.csv') {
      const rows = all(`SELECT p.*, (SELECT COUNT(*) FROM units u WHERE u.product_id = p.id AND u.status = 'in_stock') units_in FROM products p WHERE p.store_id = ? AND p.archived = 0`, ctx.store.id).map(productOut);
      body = csv(rows, ['title', 'kind', 'brand', 'model', 'storage', 'ram', 'color', 'condition', 'sku', 'cost', 'price', 'stock']);
    } else if (what === 'units.csv') {
      body = csv(all("SELECT p.title, u.imei, u.imei2, u.status, u.cost, u.created_at FROM units u JOIN products p ON p.id = u.product_id WHERE u.store_id = ? ORDER BY p.title", ctx.store.id)
        .map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() })), ['title', 'imei', 'imei2', 'status', 'cost', 'created_at']);
    } else if (what === 'sales.csv') {
      body = csv(all(`SELECT x.number, x.created_at, x.customer_name, x.customer_phone, x.method, x.status, x.subtotal, x.discount, x.total, x.paid, x.cost,
                      (SELECT GROUP_CONCAT(title || CASE WHEN imei != '' THEN ' [' || imei || ']' ELSE '' END, ' + ') FROM sale_items WHERE sale_id = x.id) items
                      FROM sales x WHERE x.store_id = ? ORDER BY x.created_at DESC`, ctx.store.id).map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() })),
      ['number', 'created_at', 'customer_name', 'customer_phone', 'items', 'method', 'status', 'subtotal', 'discount', 'total', 'paid', 'cost']);
    } else fail(404, 'not_found');
    ctx.send(200, body, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${ctx.store.slug}-${what}"` });
    return ctx.SENT;
  },

  // ----- team -----
  'GET staff': (ctx) => ({
    staff: all(`SELECT m.email, m.role, m.created_at, u.name, u.picture, u.last_login, (m.user_id IS NOT NULL) joined
                FROM members m LEFT JOIN users u ON u.id = m.user_id WHERE m.store_id = ? ORDER BY m.role = 'owner' DESC, m.created_at`, ctx.store.id),
    limit: PLANS[planOf(ctx.store)].members,
  }),
  'POST staff': (ctx, _, b) => {
    need(ctx, 'owner');
    const email = str(b.email, 120).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'bad_email');
    const role = oneOf(b.role, ['manager', 'seller'], 'seller');
    const count = get('SELECT COUNT(*) n FROM members WHERE store_id = ?', ctx.store.id).n;
    if (count >= PLANS[planOf(ctx.store)].members) fail(403, 'plan_member_limit');
    if (get('SELECT 1 FROM members WHERE store_id = ? AND email = ?', ctx.store.id, email)) fail(409, 'already_member');
    const user = get('SELECT id FROM users WHERE email = ?', email);
    run('INSERT INTO members (store_id, email, user_id, role, created_at) VALUES (?,?,?,?,?)', ctx.store.id, email, user?.id || null, role, now());
    log(ctx, 'staff_added', `${email} ${role}`);
    return { ok: true, joined: !!user };
  },
  'PUT staff': (ctx, _, b) => {
    need(ctx, 'owner');
    const email = str(b.email, 120).toLowerCase();
    const m = get('SELECT * FROM members WHERE store_id = ? AND email = ?', ctx.store.id, email);
    if (!m) fail(404, 'not_member');
    if (m.role === 'owner') fail(400, 'owner_role');
    run('UPDATE members SET role = ? WHERE store_id = ? AND email = ?', oneOf(b.role, ['manager', 'seller'], m.role), ctx.store.id, email);
    log(ctx, 'staff_role', `${email} ${b.role}`);
    return { ok: true };
  },
  'DELETE staff': (ctx, _, b) => {
    need(ctx, 'owner');
    const email = str(ctx.url.searchParams.get('email') || b.email, 120).toLowerCase();
    const m = get('SELECT * FROM members WHERE store_id = ? AND email = ?', ctx.store.id, email);
    if (!m) fail(404, 'not_member');
    if (m.role === 'owner') fail(400, 'owner_role');
    run('DELETE FROM members WHERE store_id = ? AND email = ?', ctx.store.id, email);
    log(ctx, 'staff_removed', email);
    return { ok: true };
  },

  // ----- settings -----
  'GET settings': (ctx) => {
    const { sale_seq, ...s } = ctx.store;
    const used = get('SELECT COALESCE(SUM(bytes),0) b FROM uploads WHERE store_id = ?', ctx.store.id).b;
    const plan = planOf(ctx.store);
    return { store: { ...s, url: storeUrl(s.slug), path_url: `${config.publicUrl}/s/${s.slug}/`, effective_plan: plan }, limits: PLANS[plan], storage_used: used, themes: THEMES, role: ctx.role };
  },
  'PUT settings': (ctx, _, b) => {
    need(ctx, 'owner');
    const s = ctx.store;
    const pick = (k, max) => (b[k] !== undefined ? str(b[k], max) : s[k]);
    let slug = s.slug;
    if (b.slug !== undefined && b.slug !== s.slug) {
      slug = slugify(b.slug);
      if (!validSlug(slug)) fail(400, 'bad_slug');
      if (get('SELECT 1 FROM stores WHERE slug = ? AND id != ?', slug, s.id)) fail(409, 'slug_taken');
      log(ctx, 'slug_changed', `${s.slug} → ${slug}`);
    }
    const img = (k) => (b[k] === undefined ? s[k] : (b[k] === '' || /^[\w-]{22}\.(webp|jpg)$/.test(b[k]) ? b[k] : s[k]));
    const accent = b.accent !== undefined ? (/^#[0-9a-fA-F]{6}$/.test(b.accent) ? b.accent : '') : s.accent;
    run(`UPDATE stores SET name=?, slug=?, theme=?, accent=?, currency=?, lang=?, logo=?, cover=?, phone=?, whatsapp=?, email=?, address=?, city=?,
         tagline=?, about=?, facebook=?, instagram=?, tiktok=?, receipt_note=?, low_stock=?, online_orders=?, show_prices=?, updated_at=? WHERE id = ?`,
      pick('name', 60) || s.name, slug, oneOf(b.theme, THEMES, s.theme), accent, oneOf(b.currency, ['DZD', 'EUR', 'USD', 'MAD', 'TND', 'SAR', 'AED', 'EGP'], s.currency),
      oneOf(b.lang, ['ar', 'fr', 'en'], s.lang), img('logo'), img('cover'), pick('phone', 30), pick('whatsapp', 30), pick('email', 120), pick('address', 200),
      pick('city', 60), pick('tagline', 120), pick('about', 2000), pick('facebook', 200), pick('instagram', 200), pick('tiktok', 200), pick('receipt_note', 300),
      b.low_stock !== undefined ? int(b.low_stock, 0, 1000) : s.low_stock, b.online_orders !== undefined ? (bool(b.online_orders) ? 1 : 0) : s.online_orders,
      b.show_prices !== undefined ? (bool(b.show_prices) ? 1 : 0) : s.show_prices, now(), s.id);
    return { ok: true, slug, url: storeUrl(slug) };
  },

  'GET qr': (ctx) => ({ url: storeUrl(ctx.store.slug), svg: toSvg(storeUrl(ctx.store.slug), { ecl: 'Q' }) }),

  'GET audit': (ctx) => {
    need(ctx, 'owner');
    return { audit: all('SELECT a.action, a.detail, a.created_at, a.ip, u.name, u.email FROM audit a LEFT JOIN users u ON u.id = a.user_id WHERE a.store_id = ? ORDER BY a.id DESC LIMIT 300', ctx.store.id) };
  },
};

// Raw image upload (body = WebP/JPEG bytes produced by the browser).
export async function uploadImage(ctx, sid) {
  scope(ctx, sid, 'manager');
  const quota = PLANS[planOf(ctx.store)].storageMb * 1024 * 1024;
  const used = get('SELECT COALESCE(SUM(bytes),0) b FROM uploads WHERE store_id = ?', sid).b;
  if (used > quota) fail(403, 'storage_full');
  const buf = await readBody(ctx.req, MAX_UPLOAD);
  const r = saveImage(sid, buf);
  run('INSERT OR IGNORE INTO uploads (file, store_id, bytes, created_at) VALUES (?,?,?,?)', r.file, sid, r.bytes, now());
  return r;
}

function receive(ctx, pid, b) {
  const p = loadProduct(ctx, pid);
  const cost = b.cost !== undefined && b.cost !== '' ? money(b.cost) : p.cost;
  const supplier = b.supplier_id ? get('SELECT id FROM suppliers WHERE id = ? AND store_id = ?', str(b.supplier_id, 30), ctx.store.id)?.id || null : null;
  const note = str(b.note, 200), t = now();
  if (p.track_imei) {
    const list = (Array.isArray(b.imeis) ? b.imeis : String(b.imeis || '').split(/[\s,;]+/))
      .map((x) => str(x, 20).replace(/\s/g, '')).filter(Boolean);
    const uniq = [...new Set(list)];
    if (!uniq.length) fail(400, 'imei_required');
    if (uniq.length > 500) fail(400, 'too_many');
    const bad = uniq.filter((x) => !/^[A-Za-z0-9]{6,20}$/.test(x));
    if (bad.length) fail(400, 'bad_imei', bad.join(', '));
    const added = [], warnings = [];
    tx(() => {
      for (const imei of uniq) {
        const ex = get('SELECT * FROM units WHERE store_id = ? AND imei = ?', ctx.store.id, imei);
        let uid;
        if (ex && ex.status === 'in_stock') fail(409, 'imei_exists', imei);
        if (ex) { // phone sold earlier and bought back (trade-in / return to stock)
          uid = ex.id;
          run("UPDATE units SET product_id = ?, status = 'in_stock', cost = ?, supplier_id = ?, sale_id = NULL, note = ?, updated_at = ? WHERE id = ?", pid, cost, supplier, note, t, uid);
        } else {
          uid = 'un_' + rid(8);
          run('INSERT INTO units (id, store_id, product_id, imei, status, cost, supplier_id, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            uid, ctx.store.id, pid, imei, 'in_stock', cost, supplier, note, t, t);
        }
        if (/^\d{15}$/.test(imei) && !validImei(imei)) warnings.push(imei);
        run('INSERT INTO stock_moves (id, store_id, product_id, unit_id, type, qty, cost, supplier_id, note, user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          'm_' + rid(8), ctx.store.id, pid, uid, 'in', 1, cost, supplier, note, ctx.user.id, t);
        added.push(imei);
      }
      run('UPDATE products SET updated_at = ?, cost = ? WHERE id = ?', t, cost, pid);
    });
    log(ctx, 'stock_in', `${p.title} ×${added.length}`);
    return { ok: true, added: added.length, warnings };
  }
  const qty = int(b.qty, 0, 100000);
  if (!qty) fail(400, 'qty_required');
  tx(() => {
    run('UPDATE products SET qty = qty + ?, cost = ?, updated_at = ? WHERE id = ?', qty, cost, t, pid);
    run('INSERT INTO stock_moves (id, store_id, product_id, type, qty, cost, supplier_id, note, user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      'm_' + rid(8), ctx.store.id, pid, 'in', qty, cost, supplier, note, ctx.user.id, t);
  });
  log(ctx, 'stock_in', `${p.title} ×${qty}`);
  return { ok: true, added: qty };
}

function createSale(ctx, b) {
  const items = Array.isArray(b.items) ? b.items.slice(0, 100) : [];
  if (!items.length) fail(400, 'cart_empty');
  const s = ctx.store.id, t = now();
  return tx(() => {
    const lines = [];
    const usedUnits = new Set();
    for (const it of items) {
      const p = get('SELECT * FROM products WHERE id = ? AND store_id = ?', str(it.product_id, 30), s);
      if (!p) fail(404, 'product_not_found');
      const price = it.price !== undefined ? money(it.price) : p.price;
      if (p.track_imei) {
        const u = it.unit_id
          ? get('SELECT * FROM units WHERE id = ? AND store_id = ? AND product_id = ?', str(it.unit_id, 30), s, p.id)
          : get('SELECT * FROM units WHERE imei = ? AND store_id = ? AND product_id = ?', str(it.imei, 20), s, p.id);
        if (!u) fail(404, 'unit_not_found', p.title);
        if (u.status !== 'in_stock' || usedUnits.has(u.id)) fail(409, 'unit_not_available', u.imei);
        usedUnits.add(u.id);
        lines.push({ p, unit: u, qty: 1, price, cost: u.cost || p.cost });
      } else {
        const qty = int(it.qty, 1, 10000);
        lines.push({ p, qty, price, cost: p.cost });
      }
    }
    // Stock check for quantity items (same product may appear twice).
    const need = new Map();
    for (const l of lines) if (!l.unit) need.set(l.p.id, (need.get(l.p.id) || 0) + l.qty);
    for (const [pid, q] of need) {
      const have = get('SELECT qty FROM products WHERE id = ?', pid).qty;
      if (have < q) fail(409, 'not_enough_stock', lines.find((l) => l.p.id === pid).p.title);
    }
    const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
    const discount = Math.min(money(b.discount), subtotal);
    const total = subtotal - discount;
    const method = oneOf(b.method, METHODS, 'cash');
    const paid = method === 'credit' ? Math.min(money(b.paid ?? 0), total) : (b.paid === undefined || b.paid === '' ? total : Math.min(money(b.paid), total));
    const customer = findOrCreateCustomer(ctx, b.customer);
    if (paid < total && !customer) fail(400, 'customer_required_for_debt');
    const cost = lines.reduce((a, l) => a + l.cost * l.qty, 0);
    run('UPDATE stores SET sale_seq = sale_seq + 1 WHERE id = ?', s);
    const number = get('SELECT sale_seq FROM stores WHERE id = ?', s).sale_seq;
    const id = 'x_' + rid(8);
    let orderId = null;
    if (b.order_id) orderId = get('SELECT id FROM orders WHERE id = ? AND store_id = ?', str(b.order_id, 30), s)?.id || null;
    run(`INSERT INTO sales (id, store_id, number, customer_id, customer_name, customer_phone, user_id, subtotal, discount, total, cost, paid, method, note, order_id, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, s, number, customer?.id || null, customer?.name || '', customer?.phone || '', ctx.user.id, subtotal, discount, total, cost, paid, method, str(b.note, 300), orderId, t);
    for (const l of lines) {
      run('INSERT INTO sale_items (id, sale_id, store_id, product_id, unit_id, title, imei, qty, price, cost) VALUES (?,?,?,?,?,?,?,?,?,?)',
        'i_' + rid(8), id, s, l.p.id, l.unit?.id || null, l.p.title, l.unit?.imei || '', l.qty, l.price, l.cost);
      if (l.unit) run("UPDATE units SET status = 'sold', sale_id = ?, updated_at = ? WHERE id = ?", id, t, l.unit.id);
      else run('UPDATE products SET qty = qty - ?, updated_at = ? WHERE id = ?', l.qty, t, l.p.id);
      run('INSERT INTO stock_moves (id, store_id, product_id, unit_id, type, qty, cost, sale_id, user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
        'm_' + rid(8), s, l.p.id, l.unit?.id || null, 'sale', -l.qty, l.cost, id, ctx.user.id, t);
    }
    if (orderId) run("UPDATE orders SET status = 'done', updated_at = ? WHERE id = ?", t, orderId);
    return { id, number, total };
  });
}

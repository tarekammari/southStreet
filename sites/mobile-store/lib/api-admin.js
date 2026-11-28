import { get, all, run, audit, setting, setSetting } from './db.js';
import { PLANS, planOf, storeUrl } from './config.js';
import { now, fail, str, int, oneOf, bool } from './util.js';

// Platform owner (Super Admin) dashboard. Users become super admins only through
// SUPER_ADMIN_EMAILS in the server's .env — never from the web.

const guard = (ctx) => { if (!ctx.user?.is_super) fail(403, 'forbidden'); };

export const adminRoutes = {
  'GET overview': (ctx) => {
    guard(ctx);
    const t = now(), m = t - 30 * 864e5;
    const c = get(`SELECT (SELECT COUNT(*) FROM stores) stores, (SELECT COUNT(*) FROM stores WHERE status = 'active') active,
      (SELECT COUNT(*) FROM stores WHERE status = 'suspended') suspended, (SELECT COUNT(*) FROM users) users,
      (SELECT COUNT(*) FROM products WHERE archived = 0) products, (SELECT COUNT(*) FROM units WHERE status = 'in_stock') units,
      (SELECT COUNT(*) FROM sales WHERE status = 'done' AND created_at >= ?) sales30, (SELECT COALESCE(SUM(total),0) FROM sales WHERE status = 'done' AND created_at >= ?) volume30,
      (SELECT COUNT(*) FROM orders WHERE created_at >= ?) orders30, (SELECT COUNT(*) FROM stores WHERE created_at >= ?) new30,
      (SELECT COALESCE(SUM(bytes),0) FROM uploads) storage`, m, m, m, m);
    const plans = all('SELECT plan, COUNT(*) n FROM stores GROUP BY plan');
    const signups = all('SELECT CAST(created_at / 86400000 AS INTEGER) d, COUNT(*) n FROM stores WHERE created_at >= ? GROUP BY d ORDER BY d', m).map((r) => ({ day: r.d * 864e5, n: r.n }));
    const volume = all("SELECT CAST(created_at / 86400000 AS INTEGER) d, SUM(total) total, COUNT(*) n FROM sales WHERE status = 'done' AND created_at >= ? GROUP BY d ORDER BY d", m)
      .map((r) => ({ day: r.d * 864e5, total: r.total, n: r.n }));
    const top = all(`SELECT s.id, s.name, s.slug, COUNT(x.id) n, COALESCE(SUM(x.total),0) total FROM stores s LEFT JOIN sales x ON x.store_id = s.id AND x.status = 'done' AND x.created_at >= ?
                     GROUP BY s.id ORDER BY total DESC LIMIT 8`, m);
    const expiring = all("SELECT id, name, slug, plan, plan_expires FROM stores WHERE plan_expires IS NOT NULL AND plan_expires BETWEEN ? AND ? ORDER BY plan_expires LIMIT 10", t - 7 * 864e5, t + 7 * 864e5);
    return { counts: c, plans, signups, volume, top, expiring };
  },

  'GET stores': (ctx) => {
    guard(ctx);
    const q = str(ctx.url.searchParams.get('q'), 60);
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const m = now() - 30 * 864e5;
    const rows = all(`SELECT s.id, s.slug, s.name, s.status, s.plan, s.plan_expires, s.theme, s.city, s.phone, s.created_at, u.email owner_email, u.name owner_name,
        (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id AND p.archived = 0) products,
        (SELECT COUNT(*) FROM members mb WHERE mb.store_id = s.id) members,
        (SELECT COUNT(*) FROM sales x WHERE x.store_id = s.id AND x.status = 'done' AND x.created_at >= ?) sales30,
        (SELECT COALESCE(SUM(total),0) FROM sales x WHERE x.store_id = s.id AND x.status = 'done' AND x.created_at >= ?) volume30,
        (SELECT MAX(created_at) FROM sales x WHERE x.store_id = s.id) last_sale
      FROM stores s JOIN users u ON u.id = s.owner_id ${q ? 'WHERE s.name LIKE ? OR s.slug LIKE ? OR u.email LIKE ?' : ''} ORDER BY s.created_at DESC LIMIT 500`,
    ...(q ? [m, m, like, like, like] : [m, m]));
    return { stores: rows.map((s) => ({ ...s, url: storeUrl(s.slug), effective_plan: planOf(s) })), plans: Object.keys(PLANS) };
  },

  'GET stores/:id': (ctx, [id]) => {
    guard(ctx);
    const s = get('SELECT * FROM stores WHERE id = ?', id);
    if (!s) fail(404, 'store_not_found');
    const members = all('SELECT m.email, m.role, u.name, u.last_login FROM members m LEFT JOIN users u ON u.id = m.user_id WHERE m.store_id = ?', id);
    const stats = get(`SELECT (SELECT COUNT(*) FROM products WHERE store_id = ? AND archived = 0) products, (SELECT COUNT(*) FROM units WHERE store_id = ? AND status = 'in_stock') units,
      (SELECT COUNT(*) FROM sales WHERE store_id = ? AND status = 'done') sales, (SELECT COALESCE(SUM(total),0) FROM sales WHERE store_id = ? AND status = 'done') volume,
      (SELECT COUNT(*) FROM customers WHERE store_id = ?) customers, (SELECT COUNT(*) FROM orders WHERE store_id = ?) orders,
      (SELECT COALESCE(SUM(bytes),0) FROM uploads WHERE store_id = ?) storage`, id, id, id, id, id, id, id);
    const log = all('SELECT a.action, a.detail, a.created_at, u.email FROM audit a LEFT JOIN users u ON u.id = a.user_id WHERE a.store_id = ? ORDER BY a.id DESC LIMIT 50', id);
    return { store: { ...s, url: storeUrl(s.slug), effective_plan: planOf(s) }, members, stats, log };
  },

  'PUT stores/:id': (ctx, [id], b) => {
    guard(ctx);
    const s = get('SELECT * FROM stores WHERE id = ?', id);
    if (!s) fail(404, 'store_not_found');
    const status = b.status ? oneOf(b.status, ['active', 'suspended'], s.status) : s.status;
    const plan = b.plan ? oneOf(b.plan, Object.keys(PLANS), s.plan) : s.plan;
    let expires = s.plan_expires;
    if (b.days !== undefined) {
      const d = int(b.days, 0, 3650);
      expires = d ? Math.max(now(), s.plan_expires || 0) + d * 864e5 : null;
    }
    if (b.plan_expires !== undefined) expires = b.plan_expires ? int(b.plan_expires, 0) : null;
    run('UPDATE stores SET status = ?, plan = ?, plan_expires = ?, updated_at = ? WHERE id = ?', status, plan, expires, now(), id);
    audit(id, ctx.user.id, 'admin_store_update', { status, plan, expires }, ctx.ip);
    return { ok: true };
  },

  'GET users': (ctx) => {
    guard(ctx);
    const q = str(ctx.url.searchParams.get('q'), 60);
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const rows = all(`SELECT u.id, u.email, u.name, u.picture, u.is_super, u.disabled, u.created_at, u.last_login,
        (SELECT GROUP_CONCAT(s.name || ' (' || m.role || ')', ', ') FROM members m JOIN stores s ON s.id = m.store_id WHERE m.user_id = u.id) stores
      FROM users u ${q ? 'WHERE u.email LIKE ? OR u.name LIKE ?' : ''} ORDER BY u.created_at DESC LIMIT 500`, ...(q ? [like, like] : []));
    return { users: rows };
  },

  'PUT users/:id': (ctx, [id], b) => {
    guard(ctx);
    if (id === ctx.user.id) fail(400, 'cannot_change_self');
    const u = get('SELECT * FROM users WHERE id = ?', id);
    if (!u) fail(404, 'user_not_found');
    if (u.is_super) fail(400, 'cannot_change_super');
    const disabled = bool(b.disabled) ? 1 : 0;
    run('UPDATE users SET disabled = ? WHERE id = ?', disabled, id);
    if (disabled) run('DELETE FROM sessions WHERE user_id = ?', id);
    audit(null, ctx.user.id, disabled ? 'admin_user_disabled' : 'admin_user_enabled', u.email, ctx.ip);
    return { ok: true };
  },

  'GET audit': (ctx) => {
    guard(ctx);
    return {
      audit: all(`SELECT a.action, a.detail, a.ip, a.created_at, u.email, s.name store FROM audit a LEFT JOIN users u ON u.id = a.user_id
                  LEFT JOIN stores s ON s.id = a.store_id ORDER BY a.id DESC LIMIT 500`),
    };
  },

  'GET settings': (ctx) => {
    guard(ctx);
    return { signups_open: setting('signups_open', '1') === '1', announcement: setting('announcement', ''), plans: PLANS, pricing: setting('pricing', '') };
  },

  'PUT settings': (ctx, _, b) => {
    guard(ctx);
    if (b.signups_open !== undefined) setSetting('signups_open', bool(b.signups_open) ? '1' : '0');
    if (b.announcement !== undefined) setSetting('announcement', str(b.announcement, 500));
    if (b.pricing !== undefined) setSetting('pricing', str(b.pricing, 2000));
    audit(null, ctx.user.id, 'admin_settings', '', ctx.ip);
    return { ok: true };
  },
};

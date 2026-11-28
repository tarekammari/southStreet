import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// One database, every business table carries store_id. All store queries go through
// handlers that receive the store id from the membership check (see api-store.js),
// so one store can never read or write another store's rows.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  picture TEXT NOT NULL DEFAULT '',
  is_super INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  lang TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_login INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  ua TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  via TEXT NOT NULL DEFAULT 'google'
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS qr_logins (
  id TEXT PRIMARY KEY,
  poll_hash TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  user_id TEXT,
  ua TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'trial',
  plan_expires INTEGER,
  theme TEXT NOT NULL DEFAULT 'clean',
  accent TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'DZD',
  lang TEXT NOT NULL DEFAULT 'ar',
  logo TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  facebook TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  tiktok TEXT NOT NULL DEFAULT '',
  receipt_note TEXT NOT NULL DEFAULT '',
  low_stock INTEGER NOT NULL DEFAULT 2,
  online_orders INTEGER NOT NULL DEFAULT 1,
  show_prices INTEGER NOT NULL DEFAULT 1,
  sale_seq INTEGER NOT NULL DEFAULT 0,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'seller',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (store_id, email)
);
CREATE INDEX IF NOT EXISTS members_user ON members(user_id);
CREATE INDEX IF NOT EXISTS members_email ON members(email);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'phone',
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  storage TEXT NOT NULL DEFAULT '',
  ram TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  condition TEXT NOT NULL DEFAULT 'new',
  battery INTEGER,
  warranty TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  cost INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL DEFAULT 0,
  old_price INTEGER NOT NULL DEFAULT 0,
  track_imei INTEGER NOT NULL DEFAULT 1,
  qty INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS products_store ON products(store_id, archived, updated_at);
CREATE INDEX IF NOT EXISTS products_sku ON products(store_id, sku);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  imei TEXT NOT NULL,
  imei2 TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'in_stock',
  cost INTEGER NOT NULL DEFAULT 0,
  supplier_id TEXT,
  sale_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (store_id, imei)
);
CREATE INDEX IF NOT EXISTS units_product ON units(product_id, status);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS suppliers_store ON suppliers(store_id);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS customers_store ON customers(store_id, phone);

CREATE TABLE IF NOT EXISTS stock_moves (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  unit_id TEXT,
  type TEXT NOT NULL,
  qty INTEGER NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,
  supplier_id TEXT,
  sale_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  user_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS moves_store ON stock_moves(store_id, created_at);
CREATE INDEX IF NOT EXISTS moves_product ON stock_moves(product_id, created_at);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  customer_id TEXT,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  user_id TEXT,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,
  paid INTEGER NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'done',
  note TEXT NOT NULL DEFAULT '',
  order_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sales_store ON sales(store_id, created_at);
CREATE INDEX IF NOT EXISTS sales_customer ON sales(customer_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  unit_id TEXT,
  title TEXT NOT NULL,
  imei TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL,
  price INTEGER NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product ON sale_items(store_id, product_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  user_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_customer ON payments(customer_id);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id TEXT,
  product_title TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_store ON orders(store_id, status, created_at);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount INTEGER NOT NULL,
  user_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS expenses_store ON expenses(store_id, created_at);

CREATE TABLE IF NOT EXISTS uploads (
  file TEXT NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (store_id, file)
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_store ON audit(store_id, created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

let db;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 4000;');
  db.exec(SCHEMA);
  return db;
}

const cache = new Map();
const stmt = (sql) => {
  let s = cache.get(sql);
  if (!s) { s = db.prepare(sql); cache.set(sql, s); }
  return s;
};

export const get = (sql, ...a) => stmt(sql).get(...a);
export const all = (sql, ...a) => stmt(sql).all(...a);
export const run = (sql, ...a) => stmt(sql).run(...a);

export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function audit(storeId, userId, action, detail = '', ip = '') {
  run('INSERT INTO audit (store_id, user_id, action, detail, ip, created_at) VALUES (?,?,?,?,?,?)',
    storeId || null, userId || null, action, typeof detail === 'string' ? detail : JSON.stringify(detail), ip, Date.now());
}

export const setting = (key, dflt = '') => get('SELECT value FROM settings WHERE key = ?', key)?.value ?? dflt;
export const setSetting = (key, value) => run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value));

export function backup(toFile) {
  db.exec(`VACUUM INTO '${toFile.replace(/'/g, "''")}'`);
}

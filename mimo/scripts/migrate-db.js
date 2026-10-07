/**
 * MIMO Senior — DB Migration Script
 * Fixes schema mismatches between server.js expectations and existing DB.
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'south_street.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // off during migration

function getColumns(table) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  } catch {
    return [];
  }
}

function tableExists(table) {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
  return !!row;
}

function addColumnIfMissing(table, column, definition) {
  const cols = getColumns(table);
  if (!cols.includes(column)) {
    console.log(`  ➕ Adding column ${table}.${column}`);
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } else {
    console.log(`  ✅ ${table}.${column} already exists`);
  }
}

console.log('\n🔧 MIMO Senior — DB Migration\n');
console.log('Tables:', db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name).join(', '));

// ── 1. messages table ───────────────────────────────────────────────────────
if (tableExists('messages')) {
  console.log('\n📋 Checking messages table...');
  addColumnIfMissing('messages', 'chat_id',       "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('messages', 'sender_id',     "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('messages', 'sender_name',   "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('messages', 'sender_role',   "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('messages', 'iv',            "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('messages', 'ciphertext',    "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('messages', 'enc_keys',      "TEXT DEFAULT '[]'");
  addColumnIfMissing('messages', 'msg_type',      "TEXT DEFAULT 'text'");
  addColumnIfMissing('messages', 'call_type',     "TEXT DEFAULT ''");
  addColumnIfMissing('messages', 'call_duration', "TEXT DEFAULT ''");
  addColumnIfMissing('messages', 'missed',        "INTEGER DEFAULT 0");
  addColumnIfMissing('messages', 'timestamp',     "INTEGER DEFAULT (unixepoch())");

  // Create index if missing
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)');
    console.log('  ✅ Index idx_messages_chat OK');
  } catch(e) {
    console.log('  ℹ️  Index:', e.message);
  }
} else {
  console.log('\n📋 Creating messages table from scratch...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id            TEXT PRIMARY KEY,
      chat_id       TEXT NOT NULL DEFAULT '',
      sender_id     TEXT NOT NULL DEFAULT '',
      sender_name   TEXT NOT NULL DEFAULT '',
      sender_role   TEXT NOT NULL DEFAULT '',
      iv            TEXT NOT NULL DEFAULT '',
      ciphertext    TEXT NOT NULL DEFAULT '',
      enc_keys      TEXT DEFAULT '[]',
      msg_type      TEXT DEFAULT 'text',
      call_type     TEXT DEFAULT '',
      call_duration TEXT DEFAULT '',
      missed        INTEGER DEFAULT 0,
      timestamp     INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
  `);
  console.log('  ✅ messages table created');
}

// ── 2. users table ───────────────────────────────────────────────────────────
if (tableExists('users')) {
  console.log('\n👤 Checking users table...');
  addColumnIfMissing('users', 'public_key', "TEXT DEFAULT ''");
  addColumnIfMissing('users', 'room',       "TEXT DEFAULT ''");
  addColumnIfMissing('users', 'avatar',     "TEXT DEFAULT ''");
  addColumnIfMissing('users', 'phone',      "TEXT DEFAULT ''");
  addColumnIfMissing('users', 'status',     "TEXT DEFAULT 'نشط'");
}

// ── 3. public_keys table ─────────────────────────────────────────────────────
if (!tableExists('public_keys')) {
  console.log('\n🔑 Creating public_keys table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS public_keys (
      user_id    TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `);
  console.log('  ✅ public_keys table created');
} else {
  console.log('\n🔑 public_keys table OK');
}

// ── 4. audit_logs table ──────────────────────────────────────────────────────
if (!tableExists('audit_logs')) {
  console.log('\n📝 Creating audit_logs table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id         TEXT PRIMARY KEY,
      actor_id   TEXT,
      actor_name TEXT,
      actor_role TEXT,
      action     TEXT,
      details    TEXT,
      ip         TEXT,
      timestamp  INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(timestamp);
  `);
  console.log('  ✅ audit_logs table created');
} else {
  console.log('\n📝 audit_logs table OK');
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(timestamp)');
  } catch {}
}

// ── 5. receipts table ────────────────────────────────────────────────────────
if (!tableExists('receipts')) {
  console.log('\n🧾 Creating receipts table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS receipts (
      id             TEXT PRIMARY KEY,
      encrypted_data TEXT NOT NULL DEFAULT '',
      iv             TEXT NOT NULL DEFAULT '',
      created_by     TEXT NOT NULL DEFAULT '',
      created_at     INTEGER DEFAULT (unixepoch())
    );
  `);
  console.log('  ✅ receipts table created');
} else {
  console.log('\n🧾 receipts table OK');
  addColumnIfMissing('receipts', 'iv',             "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('receipts', 'created_by',     "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing('receipts', 'encrypted_data', "TEXT NOT NULL DEFAULT ''");
}

db.pragma('foreign_keys = ON');
db.close();

console.log('\n✅ Migration complete — DB is ready\n');

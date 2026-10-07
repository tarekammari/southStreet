import type Database from 'better-sqlite3';
import { SUPER_ADMIN_ROLE_VALUES, LOGIN_ROLE_LABELS } from '@/lib/roles';

/** Primary Super Admin id; kept when legacy data holds more than one. */
export const PRIMARY_SUPER_ADMIN_ID = 'usr_super_admin';

const SUPER_SQL_LIST = SUPER_ADMIN_ROLE_VALUES.map((r) => `'${r}'`).join(', ');
export const SUPER_ADMIN_WHERE = `lower(role) IN (${SUPER_SQL_LIST})`;

/**
 * Tables and rules for hardware-key sign-in (WebAuthn), recovery codes,
 * one-time enrollment links, and the single-Super-Admin invariant.
 * Idempotent: safe to run on every start.
 */
export function initSecuritySchema(db: Database.Database) {
  const cols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
  if (cols.length && !cols.includes('tokenVersion')) db.exec('ALTER TABLE users ADD COLUMN tokenVersion INTEGER DEFAULT 0');
  if (cols.length && !cols.includes('legacyKeyAllowed')) db.exec('ALTER TABLE users ADD COLUMN legacyKeyAllowed INTEGER DEFAULT 1');

  db.exec(`
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      credential_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER DEFAULT 0,
      transports TEXT,
      label TEXT,
      created_at TEXT,
      last_used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(user_id);

    CREATE TABLE IF NOT EXISTS auth_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      challenge TEXT NOT NULL,
      purpose TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recovery_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      codeHash TEXT NOT NULL,
      used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_codes(user_id);

    CREATE TABLE IF NOT EXISTS enrollment_tokens (
      tokenHash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      reason TEXT,
      created_by TEXT,
      expires_at INTEGER NOT NULL,
      used_at TEXT
    );
  `);

  enforceSingleSuperAdmin(db);

  // Role titles follow the two privileged names: Super Admin and Admin.
  db.prepare(`UPDATE users SET roleName = ? WHERE ${SUPER_ADMIN_WHERE}`).run(LOGIN_ROLE_LABELS.SUPER_ADMIN);
  db.prepare("UPDATE users SET roleName = ? WHERE lower(role) IN ('agency_manager', 'manager')").run(LOGIN_ROLE_LABELS.AGENCY_MANAGER);
}

/**
 * Exactly one Super Admin. Legacy data may hold several (role 'admin');
 * the primary account is kept, the rest become Admins and lose their sessions.
 * Triggers then make a second Super Admin impossible at the database level.
 */
function enforceSingleSuperAdmin(db: Database.Database) {
  const supers = db
    .prepare(`SELECT id, createdAt FROM users WHERE ${SUPER_ADMIN_WHERE}`)
    .all() as { id: string; createdAt?: string }[];

  if (supers.length > 1) {
    const keep = supers.find((u) => u.id === PRIMARY_SUPER_ADMIN_ID)
      || [...supers].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))[0];
    const demote = db.prepare(
      `UPDATE users SET role = 'AGENCY_MANAGER', roleName = ?, tokenVersion = IFNULL(tokenVersion, 0) + 1 WHERE id = ?`
    );
    db.transaction(() => {
      for (const u of supers) {
        if (u.id !== keep.id) {
          demote.run(LOGIN_ROLE_LABELS.AGENCY_MANAGER, u.id);
          console.warn(`[security] Demoted extra Super Admin ${u.id} to Admin (single Super Admin rule).`);
        }
      }
    })();
  }

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_single_super_admin_insert
    BEFORE INSERT ON users
    WHEN lower(NEW.role) IN (${SUPER_SQL_LIST})
      AND (SELECT count(*) FROM users WHERE ${SUPER_ADMIN_WHERE}) >= 1
    BEGIN
      SELECT RAISE(ABORT, 'SINGLE_SUPER_ADMIN');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_single_super_admin_update
    BEFORE UPDATE OF role ON users
    WHEN lower(NEW.role) IN (${SUPER_SQL_LIST})
      AND lower(IFNULL(OLD.role, '')) NOT IN (${SUPER_SQL_LIST})
      AND (SELECT count(*) FROM users WHERE ${SUPER_ADMIN_WHERE}) >= 1
    BEGIN
      SELECT RAISE(ABORT, 'SINGLE_SUPER_ADMIN');
    END;
  `);
}

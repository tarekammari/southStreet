/**
 * Rules the Super Admin sets for SS Connect (dashboard /connect/admin):
 *  - per person: suspended (no Connect at all) or calls blocked, with a reason
 *    and an optional end date;
 *  - for everyone: calls on/off, clients writing to other clients on/off,
 *    calls through the relay only (nobody sees anyone's IP address).
 * The Super Admin is never affected (the dashboard must stay usable).
 * Tables are added on first use.
 */
import { getSqliteDb } from '../sqlite';

export type ConnectControl = { suspended: boolean; callsBlocked: boolean; reason: string; untilTs: number | null; by: string; ts: number };
export type ConnectSettings = { calls: boolean; clientChat: boolean; relayOnly: boolean };

const DEFAULTS: ConnectSettings = { calls: true, clientChat: true, relayOnly: false };

let ready = false;
function db() {
  const d = getSqliteDb();
  if (ready) return d;
  d.exec(`
    CREATE TABLE IF NOT EXISTS connect_controls (
      user_id TEXT PRIMARY KEY, suspended INTEGER NOT NULL DEFAULT 0, calls_blocked INTEGER NOT NULL DEFAULT 0,
      reason TEXT, until_ts INTEGER, by_name TEXT, ts INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS connect_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  ready = true;
  return d;
}

const NONE: ConnectControl = { suspended: false, callsBlocked: false, reason: '', untilTs: null, by: '', ts: 0 };

/** The rules for one person (a rule whose end date passed is lifted by itself). */
export function controlOf(userId: string): ConnectControl {
  const r = db().prepare('SELECT * FROM connect_controls WHERE user_id = ?').get(userId) as any;
  if (!r) return NONE;
  if (r.until_ts && Number(r.until_ts) < Date.now()) {
    db().prepare('DELETE FROM connect_controls WHERE user_id = ?').run(userId);
    return NONE;
  }
  return {
    suspended: Boolean(r.suspended),
    callsBlocked: Boolean(r.calls_blocked),
    reason: String(r.reason || ''),
    untilTs: r.until_ts ? Number(r.until_ts) : null,
    by: String(r.by_name || ''),
    ts: Number(r.ts) || 0,
  };
}

export function allControls(): Map<string, ConnectControl> {
  const ids = (db().prepare('SELECT user_id FROM connect_controls').all() as { user_id: string }[]).map((r) => String(r.user_id));
  return new Map(ids.map((id) => [id, controlOf(id)] as const).filter(([, c]) => c.suspended || c.callsBlocked));
}

export function setControl(userId: string, patch: Partial<Pick<ConnectControl, 'suspended' | 'callsBlocked' | 'reason' | 'untilTs'>>, by: string): ConnectControl {
  const cur = controlOf(userId);
  const next = { ...cur, ...patch };
  if (!next.suspended && !next.callsBlocked) {
    db().prepare('DELETE FROM connect_controls WHERE user_id = ?').run(userId);
    return NONE;
  }
  db().prepare(
    `INSERT INTO connect_controls (user_id, suspended, calls_blocked, reason, until_ts, by_name, ts) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET suspended = excluded.suspended, calls_blocked = excluded.calls_blocked,
       reason = excluded.reason, until_ts = excluded.until_ts, by_name = excluded.by_name, ts = excluded.ts`
  ).run(userId, next.suspended ? 1 : 0, next.callsBlocked ? 1 : 0, String(next.reason || '').slice(0, 300), next.untilTs || null, by, Date.now());
  return controlOf(userId);
}

export function settings(): ConnectSettings {
  const rows = db().prepare('SELECT key, value FROM connect_settings').all() as { key: string; value: string }[];
  const s = { ...DEFAULTS };
  for (const r of rows) if (r.key in s) (s as Record<string, boolean>)[r.key] = r.value === '1';
  return s;
}

export function saveSettings(patch: Partial<ConnectSettings>): ConnectSettings {
  const put = db().prepare('INSERT INTO connect_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(patch)) if (k in DEFAULTS && typeof v === 'boolean') put.run(k, v ? '1' : '0');
  return settings();
}

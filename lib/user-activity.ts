import { getSqliteDb } from '@/lib/sqlite';

function dayKey(raw?: string | null): string | null {
  if (!raw) return null;
  const t = new Date(raw);
  if (!Number.isFinite(t.getTime())) return null;
  return t.toISOString().slice(0, 10);
}

function bump(counts: Record<string, number>, raw?: string | null, n = 1) {
  const key = dayKey(raw);
  if (!key) return;
  counts[key] = (counts[key] || 0) + n;
}

/** Daily app-use counts for a GitHub-style contribution map. */
export function collectUserActivity(userId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  try {
    const db = getSqliteDb();
    const user = db.prepare('SELECT id, name, email, createdAt FROM users WHERE id = ?').get(userId) as
      | { id?: string; name?: string; email?: string; createdAt?: string }
      | undefined;

    bump(counts, user?.createdAt, 1);

    const sessions = db
      .prepare(
        `SELECT loginTime, lastActive FROM sessions
         WHERE userId = ? OR (? != '' AND userEmail = ?)`
      )
      .all(userId, user?.email || '', user?.email || '') as { loginTime?: string; lastActive?: string }[];

    for (const session of sessions) {
      bump(counts, session.loginTime, 2);
      bump(counts, session.lastActive, 1);
    }

    const firstName = (user?.name || '').trim().split(/\s+/)[0];
    if (firstName) {
      const logs = db
        .prepare('SELECT timestamp, actorName FROM audit_logs WHERE actorName LIKE ?')
        .all(`%${firstName}%`) as { timestamp?: string }[];
      for (const log of logs) bump(counts, log.timestamp, 1);
    }

    try {
      const messages = db
        .prepare('SELECT time FROM messages WHERE senderId = ?')
        .all(userId) as { time?: string }[];
      for (const msg of messages) bump(counts, msg.time, 1);
    } catch {
      /* messages table may be empty or differently shaped */
    }
  } catch {
    /* heatmap stays empty if sqlite is unavailable */
  }
  return counts;
}

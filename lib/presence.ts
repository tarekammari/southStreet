import { getSqliteDb } from '@/lib/sqlite';
import type { ActiveSession } from '@/lib/db';

export type PresenceInput = {
  userId: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  ip: string;
  pcPrint: string;
  userAgent: string;
};

function nowIso() {
  return new Date().toISOString();
}

function asSession(row: any, fallback: PresenceInput, now: string): ActiveSession {
  return {
    id: row?.id || `sess_${Date.now()}_${fallback.userId}`,
    userId: fallback.userId,
    userName: fallback.userName || row?.userName || '',
    userEmail: fallback.userEmail || row?.userEmail || '',
    userRole: fallback.userRole || row?.userRole || '',
    ip: fallback.ip,
    pcPrint: fallback.pcPrint,
    userAgent: fallback.userAgent,
    loginTime: row?.loginTime || now,
    lastActive: now,
    endedAt: row?.endedAt || null,
  };
}

function isOpen(row: { endedAt?: string | null } | undefined) {
  return !row?.endedAt;
}

/** Insert or refresh the signed-in user's live session for this device. */
export function upsertUserSession(input: PresenceInput): ActiveSession {
  const db = getSqliteDb();
  const now = nowIso();
  const existing = db
    .prepare(
      `SELECT id, loginTime, endedAt FROM sessions
       WHERE userId = ? AND IFNULL(pcPrint, '') = ?
       ORDER BY rowid DESC LIMIT 1`
    )
    .get(input.userId, input.pcPrint || '') as { id?: string; loginTime?: string; endedAt?: string } | undefined;

  if (existing?.id && isOpen(existing)) {
    db.prepare(
      `UPDATE sessions
       SET lastActive = ?, ip = ?, userAgent = ?,
           userName = COALESCE(NULLIF(?, ''), userName),
           userEmail = COALESCE(NULLIF(?, ''), userEmail),
           userRole = COALESCE(NULLIF(?, ''), userRole)
       WHERE id = ?`
    ).run(
      now,
      input.ip,
      input.userAgent,
      input.userName || '',
      input.userEmail || '',
      input.userRole || '',
      existing.id
    );
    return asSession(existing, input, now);
  }

  const id = `sess_${Date.now()}_${input.userId}`;
  db.prepare(
    `INSERT INTO sessions (id, userId, userName, userEmail, userRole, ip, pcPrint, userAgent, loginTime, lastActive, endedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
  ).run(
    id,
    input.userId,
    input.userName || '',
    input.userEmail || '',
    input.userRole || '',
    input.ip,
    input.pcPrint,
    input.userAgent,
    now,
    now
  );

  return {
    id,
    userId: input.userId,
    userName: input.userName || '',
    userEmail: input.userEmail || '',
    userRole: input.userRole || '',
    ip: input.ip,
    pcPrint: input.pcPrint,
    userAgent: input.userAgent,
    loginTime: now,
    lastActive: now,
    endedAt: null,
  };
}

export function endUserSession(userId: string) {
  try {
    getSqliteDb()
      .prepare(
        `UPDATE sessions SET endedAt = ?, lastActive = ?
         WHERE userId = ? AND (endedAt IS NULL OR endedAt = '')`
      )
      .run(nowIso(), nowIso(), userId);
  } catch {
    /* sign-out must not fail */
  }
}

export function listSessions(): ActiveSession[] {
  try {
    return getSqliteDb()
      .prepare(
        `SELECT * FROM sessions
         WHERE endedAt IS NULL OR endedAt = ''`
      )
      .all() as ActiveSession[];
  } catch {
    return [];
  }
}

export function listUserSessions(userId: string, email?: string): ActiveSession[] {
  try {
    const db = getSqliteDb();
    if (email) {
      return db
        .prepare(
          `SELECT * FROM sessions
           WHERE userId = ? OR userEmail = ?
           ORDER BY COALESCE(lastActive, loginTime) DESC`
        )
        .all(userId, email) as ActiveSession[];
    }
    return db
      .prepare(
        `SELECT * FROM sessions
         WHERE userId = ?
         ORDER BY COALESCE(lastActive, loginTime) DESC`
      )
      .all(userId) as ActiveSession[];
  } catch {
    return [];
  }
}

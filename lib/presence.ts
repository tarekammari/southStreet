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

/** Insert or refresh the signed-in user's live session row. */
export function upsertUserSession(input: PresenceInput): ActiveSession {
  const db = getSqliteDb();
  const now = nowIso();
  const existing = db
    .prepare('SELECT id, loginTime FROM sessions WHERE userId = ? ORDER BY rowid DESC LIMIT 1')
    .get(input.userId) as { id?: string; loginTime?: string } | undefined;

  if (existing?.id) {
    db.prepare(
      `UPDATE sessions
       SET lastActive = ?, ip = ?, pcPrint = ?, userAgent = ?,
           userName = COALESCE(NULLIF(?, ''), userName),
           userEmail = COALESCE(NULLIF(?, ''), userEmail),
           userRole = COALESCE(NULLIF(?, ''), userRole)
       WHERE id = ?`
    ).run(
      now,
      input.ip,
      input.pcPrint,
      input.userAgent,
      input.userName || '',
      input.userEmail || '',
      input.userRole || '',
      existing.id
    );
    return {
      id: existing.id,
      userId: input.userId,
      userName: input.userName || '',
      userEmail: input.userEmail || '',
      userRole: input.userRole || '',
      ip: input.ip,
      pcPrint: input.pcPrint,
      userAgent: input.userAgent,
      loginTime: existing.loginTime || now,
      lastActive: now,
    };
  }

  const id = `sess_${Date.now()}_${input.userId}`;
  db.prepare(
    `INSERT INTO sessions (id, userId, userName, userEmail, userRole, ip, pcPrint, userAgent, loginTime, lastActive)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
  };
}

export function endUserSession(userId: string) {
  try {
    getSqliteDb().prepare('DELETE FROM sessions WHERE userId = ?').run(userId);
  } catch {
    /* sign-out must not fail */
  }
}

export function listSessions(): ActiveSession[] {
  try {
    return getSqliteDb().prepare('SELECT * FROM sessions').all() as ActiveSession[];
  } catch {
    return [];
  }
}

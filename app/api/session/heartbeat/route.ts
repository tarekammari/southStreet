import { NextRequest, NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { verifyToken } from '@/lib/auth';
import { generateDeviceFingerprint } from '@/lib/security';
import { getTokenFromRequest } from '@/lib/request-auth';

function clientMeta(req: NextRequest) {
  const headers = req.headers;
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || '127.0.0.1';
  const userAgent = headers.get('user-agent') || 'Mozilla/5.0';
  const acceptLang = headers.get('accept-language') || 'ar-DZ';
  const { pcPrint } = generateDeviceFingerprint(ip, userAgent, acceptLang);
  return { ip, userAgent, pcPrint };
}

/**
 * Keeps `sessions.lastActive` fresh while a signed-in user has the app open.
 * Without it every session looks stale the moment the login timestamp ages out.
 */
export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload?.sub) {
    return NextResponse.json({ error: 'جلسة غير صالحة' }, { status: 401 });
  }

  const { ip, userAgent, pcPrint } = clientMeta(req);
  const now = new Date().toISOString();

  try {
    const db = getSqliteDb();
    const result = db
      .prepare('UPDATE sessions SET lastActive = ?, ip = ?, pcPrint = ?, userAgent = ? WHERE userId = ?')
      .run(now, ip, pcPrint, userAgent, payload.sub);

    if (result.changes === 0) {
      db.prepare(
        `INSERT INTO sessions (id, userId, userName, userEmail, userRole, ip, pcPrint, userAgent, loginTime, lastActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `sess_${Date.now()}_${payload.sub}`,
        payload.sub,
        payload.name || '',
        payload.email || '',
        payload.role || '',
        ip,
        pcPrint,
        userAgent,
        now,
        now
      );
    }

    db.prepare('UPDATE users SET lastLoginIp = ?, pcFingerprint = ? WHERE id = ?').run(ip, pcPrint, payload.sub);

    return NextResponse.json({ ok: true, userId: payload.sub, lastActive: now, ip });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذّر تحديث الجلسة' }, { status: 500 });
  }
}

/** Ends the session immediately instead of waiting for the online window to lapse. */
export async function DELETE(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload?.sub) return NextResponse.json({ ok: true });

  try {
    getSqliteDb().prepare('DELETE FROM sessions WHERE userId = ?').run(payload.sub);
  } catch {
    /* signing out must never fail on the client */
  }
  return NextResponse.json({ ok: true });
}

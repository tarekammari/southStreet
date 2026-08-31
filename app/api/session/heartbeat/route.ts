import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generateDeviceFingerprint } from '@/lib/security';
import { getTokenFromRequest } from '@/lib/request-auth';
import { resolveRequestIp } from '@/lib/security-threats';
import { endUserSession, upsertUserSession } from '@/lib/presence';

function clientMeta(req: NextRequest) {
  const headers = req.headers;
  const ip = resolveRequestIp({
    forwarded: headers.get('x-forwarded-for'),
    realIp: headers.get('x-real-ip'),
    fallback: '127.0.0.1',
  });
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

  try {
    const session = upsertUserSession({
      userId: payload.sub,
      userName: payload.name || '',
      userEmail: payload.email || '',
      userRole: String(payload.role || ''),
      ip,
      pcPrint,
      userAgent,
    });

    return NextResponse.json({
      ok: true,
      userId: payload.sub,
      lastActive: session.lastActive,
      ip: session.ip,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذّر تحديث الجلسة' }, { status: 500 });
  }
}

/** Ends the session immediately instead of waiting for the online window to lapse. */
export async function DELETE(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload?.sub) return NextResponse.json({ ok: true });
  endUserSession(payload.sub);
  return NextResponse.json({ ok: true });
}

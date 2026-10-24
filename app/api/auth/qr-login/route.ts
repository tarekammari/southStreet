import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { requireSession } from '@/lib/staff-gate';
import { isPrivilegedRole, normalizeLoginRole } from '@/lib/roles';
import { dbLogAudit } from '@/lib/db';
import { clientMeta, completeLogin } from '@/lib/login-session';
import { answerQrLogin, pollQrLogin, scanQrLogin, startQrLogin } from '@/lib/qr-login';

export const dynamic = 'force-dynamic';

/**
 * Sign in on a computer with a phone (lib/qr-login.ts).
 *   POST {action:'start'}                  computer — a new QR request
 *   GET  ?id=&key=                         computer — status; signs in once approved
 *   POST {action:'scan', id}               phone (signed in) — who asks, and 3 numbers
 *   POST {action:'approve', id, pick}      phone — the number shown on the computer
 *   POST {action:'deny', id}               phone — «ليس أنا»
 */
const noStore = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const result = pollQrLogin(url.searchParams.get('id') || '', url.searchParams.get('key') || '');
  if (result.status !== 'APPROVED') return NextResponse.json(result, { headers: noStore });

  const user = getSqliteDb().prepare('SELECT * FROM users WHERE id = ?').get(result.userId) as any;
  if (!user || user.loginEnabled === 0 || ['SUSPENDED', 'REJECTED'].includes(String(user.status || '').toUpperCase())) {
    return NextResponse.json({ status: 'DENIED', error: 'هذا الحساب غير مفعّل' }, { headers: noStore });
  }
  const meta = clientMeta(req);
  const res = completeLogin(user, meta, { method: 'qr-phone' });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const meta = clientMeta(req);

  if (action === 'start') {
    const started = startQrLogin({ ip: meta.clientIp, userAgent: meta.userAgent });
    if (!started) return NextResponse.json({ error: 'محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة' }, { status: 429, headers: noStore });
    return NextResponse.json(started, { headers: noStore });
  }

  const gate = requireSession(req);
  if ('error' in gate) return gate.error;
  const role = normalizeLoginRole(gate.account.role);
  if (isPrivilegedRole(role)) {
    return NextResponse.json({ error: 'حسابات الإدارة تدخل على الكمبيوتر بمفتاح الأمان، لا بالهاتف' }, { status: 403, headers: noStore });
  }
  const id = String(body.id || '');

  if (action === 'scan') {
    const r = scanQrLogin(id, { id: gate.account.id, name: gate.account.name || '', avatar: gate.account.avatar || undefined });
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.code, headers: noStore });
    return NextResponse.json({ ...r, name: gate.account.name }, { headers: noStore });
  }

  if (action === 'approve' || action === 'deny') {
    const pick = action === 'approve' ? Number(body.pick) : null;
    const r = answerQrLogin(id, gate.account.id, pick === null || Number.isFinite(pick) ? pick : -1);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.code, headers: noStore });
    try {
      dbLogAudit(
        gate.account.name,
        gate.account.role,
        r.status === 'APPROVED' ? 'دخول كمبيوتر بمسح QR من الهاتف' : 'رفض دخول كمبيوتر بمسح QR',
        `phone ip=${meta.clientIp}`,
        meta.clientIp
      );
    } catch {
      /* audit is best-effort */
    }
    return NextResponse.json(
      {
        status: r.status,
        message: r.status === 'APPROVED' ? 'تم — الكمبيوتر يدخل إلى حسابك الآن' : action === 'deny' ? 'أُلغي الطلب، لن يدخل أحد إلى حسابك' : 'الرقم غير صحيح — أُلغي الطلب للأمان',
      },
      { headers: noStore }
    );
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400, headers: noStore });
}

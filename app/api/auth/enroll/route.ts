import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { hashPassword } from '@/lib/security';
import { dbLogAudit } from '@/lib/db';
import { isPrivilegedRole, normalizeLoginRole, LOGIN_ROLE_LABELS } from '@/lib/roles';
import { checkPrivilegedPassword } from '@/lib/password-policy';
import { clientMeta, lockoutResponse, recordLoginFailure } from '@/lib/login-session';
import {
  beginRegistration,
  bumpTokenVersion,
  consumeEnrollmentToken,
  deleteCredential,
  finishRegistration,
  issueRecoveryCodes,
  parseKeyKind,
  readEnrollmentToken,
} from '@/lib/webauthn';

/**
 * One-time activation link for Super Admin / Admin accounts:
 * set a new password + register the first security key + receive recovery codes.
 */

function loadTarget(token: string) {
  const link = readEnrollmentToken(token);
  if (!link) return null;
  const user = getSqliteDb().prepare('SELECT * FROM users WHERE id = ?').get(link.userId) as any;
  if (!user || !isPrivilegedRole(normalizeLoginRole(user.role))) return null;
  return { link, user };
}

const INVALID = () =>
  NextResponse.json({ error: 'رابط التفعيل غير صالح أو منتهي الصلاحية' }, { status: 410 });

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('t') || '';
  const target = loadTarget(token);
  if (!target) return INVALID();
  const role = normalizeLoginRole(target.user.role);
  return NextResponse.json({
    name: target.user.name,
    username: target.user.username,
    role,
    roleLabel: LOGIN_ROLE_LABELS[role],
    reason: target.link.reason,
  });
}

export async function POST(req: Request) {
  const meta = clientMeta(req);
  const locked = lockoutResponse(meta);
  if (locked) return locked;

  const body = await req.json().catch(() => ({}));
  const token = String(body.t || '');
  const target = loadTarget(token);
  if (!target) {
    recordLoginFailure(meta, 'رابط تفعيل غير صالح');
    return INVALID();
  }
  const { user, link } = target;
  const password = String(body.password || '');
  const policy = checkPrivilegedPassword(password, user.username);
  if (!policy.ok) {
    return NextResponse.json({ error: `كلمة المرور ضعيفة: ${policy.errors.join('، ')}` }, { status: 400 });
  }

  try {
    if (body.action === 'options') {
      const started = await beginRegistration(
        req,
        { id: user.id, username: user.username, name: user.name },
        {},
        parseKeyKind(body.kind)
      );
      return NextResponse.json(started);
    }

    if (body.action === 'verify') {
      const result = await finishRegistration(req, String(body.flowToken || ''), body.response, String(body.label || 'مفتاح الأمان الرئيسي'));
      if (result.userId !== user.id || !consumeEnrollmentToken(token)) {
        deleteCredential(result.userId, result.credentialId);
        return INVALID();
      }
      const db = getSqliteDb();
      db.prepare('UPDATE users SET passwordHash = ?, legacyKeyAllowed = 0 WHERE id = ?').run(hashPassword(password), user.id);
      const recoveryCodes = issueRecoveryCodes(user.id);
      bumpTokenVersion(user.id);
      try {
        dbLogAudit(user.name, user.role, 'تفعيل مفتاح الأمان', `سبب الرابط: ${link.reason}`, meta.clientIp);
      } catch {
        /* optional */
      }
      return NextResponse.json({ ok: true, username: user.username, recoveryCodes });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error: any) {
    const msg = String(error?.message || '');
    const known: Record<string, string> = {
      FLOW_EXPIRED: 'انتهت مهلة التسجيل — أعد المحاولة',
      KEY_NOT_VERIFIED: 'تعذّر التحقق من مفتاح الأمان',
      KEY_ALREADY_REGISTERED: 'هذا المفتاح مسجّل مسبقاً',
      MAX_KEYS: 'تم بلوغ الحد الأقصى للمفاتيح',
      WEBAUTHN_NOT_CONFIGURED: 'إعدادات مفاتيح الأمان غير مكتملة على الخادم (WEBAUTHN_RP_ID و WEBAUTHN_ORIGINS في ملف .env)',
    };
    if (!known[msg]) console.error('[auth/enroll]', error);
    return NextResponse.json({ error: known[msg] || 'تعذّر إكمال التفعيل' }, { status: 400 });
  }
}

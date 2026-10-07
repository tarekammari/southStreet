import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getSqliteDb } from '@/lib/sqlite';
import { verifyPassword } from '@/lib/security';
import { findUserForLogin, findUserByQr, queueAccessRequest } from '@/lib/accounts';
import { normalizeLoginRole, isPrivilegedRole } from '@/lib/roles';
import { dbLogAudit } from '@/lib/db';
import {
  clientMeta,
  completeLogin,
  lockoutResponse,
  recordLoginFailure,
} from '@/lib/login-session';
import { beginAuthentication, countCredentials, createEnrollmentToken } from '@/lib/webauthn';

/**
 * Step 1 of sign-in (password or QR).
 * Super Admin / Admin never get a session here: they continue to the
 * security-key step (/api/auth/webauthn/login).
 */

const LEGACY_KEY_PATTERN = /SOUTHSTREET-KEY-v1-[A-F0-9]{16}/;

function storedLegacyKey(): string {
  try {
    const row = getSqliteDb().prepare("SELECT security_key FROM agency_settings WHERE id = 'main'").get() as { security_key?: string } | undefined;
    return String(row?.security_key || getDatabase().securityKey || '').trim();
  } catch {
    return '';
  }
}

/** Exact, constant-time match of the Key-Id inside an uploaded legacy key file. */
function legacyKeyMatches(uploaded: string): boolean {
  const expected = storedLegacyKey();
  const found = String(uploaded || '').match(LEGACY_KEY_PATTERN)?.[0] || '';
  if (!expected || !found) return false;
  const a = Buffer.from(found);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const meta = clientMeta(req);
  try {
    const body = await req.json().catch(() => ({}));
    const { email, username, password, fileKey, website_hp, qrPayload } = body as Record<string, string>;
    const identifier = String(username || email || '').trim().slice(0, 120);

    if (website_hp && String(website_hp).trim().length > 0) {
      return NextResponse.json({ error: 'تم حظر الطلب' }, { status: 403 });
    }

    const ipLocked = lockoutResponse(meta);
    if (ipLocked) return ipLocked;

    let user: any = null;
    let plainPassword: string | undefined;

    if (qrPayload) {
      const found = findUserByQr(String(qrPayload));
      if (!found) {
        recordLoginFailure(meta, 'رمز QR غير صالح');
        return NextResponse.json({ error: 'رمز QR غير صالح أو منتهي' }, { status: 401 });
      }
      user = found.user;
    } else {
      if (!identifier || !password) {
        return NextResponse.json({ error: 'يرجى إدخال اسم المستخدم (أو البريد) وكلمة المرور' }, { status: 400 });
      }
      user = findUserForLogin(identifier);
      if (!user) {
        const sqlite = getSqliteDb();
        user =
          (sqlite.prepare('SELECT * FROM users WHERE username = ?').get(identifier) as any) ||
          (sqlite.prepare('SELECT * FROM users WHERE email = ?').get(identifier.toLowerCase()) as any);
      }
      const accountLocked = user ? lockoutResponse(meta, user.id) : null;
      if (accountLocked) return accountLocked;
      if (!user || !verifyPassword(String(password).slice(0, 200), user.passwordHash || user.password_hash)) {
        recordLoginFailure(meta, 'اسم مستخدم أو كلمة مرور خاطئة', user?.id);
        return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
      }
      plainPassword = String(password);
    }

    if (user.loginEnabled === 0 || user.loginEnabled === false) {
      return NextResponse.json({ error: 'تم إيقاف صلاحية الدخول لهذا الحساب' }, { status: 403 });
    }

    if (user.status === 'PENDING_APPROVAL' || user.status === 'PENDING') {
      queueAccessRequest({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        ip: meta.clientIp,
        pcPrint: meta.pcPrint,
        userAgent: meta.userAgent,
      });
      return NextResponse.json({
        status: 'PENDING_APPROVAL',
        message: 'طلبك قيد المراجعة. سنخبرك بعد تأكيد الوكالة.',
        ip: meta.clientIp,
        pcPrint: meta.pcPrint,
      }, { status: 403 });
    }

    if (user.status === 'REJECTED' || user.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'تم تعليق هذا الحساب من طرف الإدارة.' }, { status: 403 });
    }

    const role = normalizeLoginRole(user.role);
    if (!isPrivilegedRole(role)) {
      return completeLogin(user, meta, { plainPassword, method: qrPayload ? 'qr' : 'password' });
    }

    // ---- Super Admin / Admin: second factor -------------------------------
    if (countCredentials(user.id) > 0) {
      const started = await beginAuthentication(req, user.id, 'login');
      return NextResponse.json({
        status: 'REQUIRES_SECURITY_KEY',
        flowToken: started!.flowToken,
        options: started!.options,
        name: user.name,
      });
    }

    // Transition: the existing Super Admin registers a first key using the
    // old key file, once. After that the file is retired for good.
    const legacyAllowed = role === 'SUPER_ADMIN' && user.legacyKeyAllowed !== 0 && Boolean(storedLegacyKey());
    if (legacyAllowed) {
      if (!fileKey) {
        return NextResponse.json({
          status: 'REQUIRES_FILE_KEY',
          message: 'لتفعيل مفتاح الأمان لأول مرة، ارفع ملف المفتاح الحالي.',
        });
      }
      if (!legacyKeyMatches(String(fileKey))) {
        recordLoginFailure(meta, 'ملف مفتاح أمان خاطئ', user.id);
        return NextResponse.json({ error: 'ملف المفتاح غير صحيح' }, { status: 403 });
      }
      const token = createEnrollmentToken(user.id, 'first-key', 'legacy-key-file', 30);
      try {
        dbLogAudit(user.name, user.role, 'بدء تفعيل مفتاح الأمان', 'عبر ملف المفتاح القديم', meta.clientIp);
      } catch {
        /* optional */
      }
      return NextResponse.json({
        status: 'ENROLLMENT_REQUIRED',
        enrollUrl: `/enroll?t=${encodeURIComponent(token)}`,
        message: 'تم التحقق. سجّل الآن مفتاح الأمان الخاص بك.',
      });
    }

    return NextResponse.json(
      {
        status: 'ENROLLMENT_REQUIRED',
        error:
          role === 'SUPER_ADMIN'
            ? 'لا يوجد مفتاح أمان مسجّل. شغّل الأمر npm run admin:recover على الخادم لإصدار رابط التفعيل.'
            : 'لا يوجد مفتاح أمان مسجّل لهذا الحساب. اطلب رابط التفعيل من المشرف العام.',
      },
      { status: 403 }
    );
  } catch (error: any) {
    console.error('[Auth Route Error]:', error?.message || error);
    return NextResponse.json({ error: 'خطأ في معالجة طلب الدخول' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getSqliteDb } from '@/lib/sqlite';
import { upsertUserSession } from '@/lib/presence';
import { hashPassword, verifyPassword, needsPasswordRehash, generateDeviceFingerprint } from '@/lib/security';
import { findUserForLogin, findUserByQr, queueAccessRequest, repairSuperAdminLogin } from '@/lib/accounts';
import { signToken } from '@/lib/auth';
import { normalizeLoginRole, postLoginPath, requiresSecurityKey, LOGIN_ROLE_LABELS, AppRedirectPath } from '@/lib/roles';
import { dbLogAudit } from '@/lib/db';
import { pilgrimAppointment, pilgrimWaitingRedirect } from '@/lib/booking';
import { recordLoginIncident } from '@/lib/security-monitor';
import { resolveRequestIp } from '@/lib/security-threats';

const failedAttemptsMap = new Map<string, { count: number; lockUntil: number }>();
let superAdminReady = false;

function isLocalDev(ip: string) {
  const n = (ip || '').trim().toLowerCase();
  if (process.env.NODE_ENV !== 'production') return true;
  return n === '127.0.0.1' || n === '::1' || n === 'localhost' || n.startsWith('::ffff:127.');
}

function clientMeta(req: Request) {
  const headers = req.headers;
  const clientIp = resolveRequestIp({
    forwarded: headers.get('x-forwarded-for'),
    realIp: headers.get('x-real-ip'),
    fallback: '127.0.0.1',
  });
  const userAgent = headers.get('user-agent') || 'Mozilla/5.0';
  const acceptLang = headers.get('accept-language') || 'ar-DZ';
  const { pcPrint } = generateDeviceFingerprint(clientIp, userAgent, acceptLang);
  return { clientIp, userAgent, pcPrint };
}

function recordFailure(ip: string, reason = 'بيانات دخول خاطئة', userAgent = '') {
  if (isLocalDev(ip)) return;
  const now = Date.now();
  const rec = failedAttemptsMap.get(ip) || { count: 0, lockUntil: 0 };
  rec.count += 1;
  if (rec.count >= 4) rec.lockUntil = now + 15 * 60 * 1000;
  failedAttemptsMap.set(ip, rec);
  try {
    recordLoginIncident({
      ip,
      userAgent,
      reason: rec.lockUntil > now ? `${reason} — تم حظر العنوان 15 دقيقة` : reason,
      blocked: rec.lockUntil > now,
    });
  } catch {
    /* monitoring must not break login */
  }
}

function lockoutResponse(ip: string) {
  if (isLocalDev(ip)) return null;
  const now = Date.now();
  const ipRecord = failedAttemptsMap.get(ip);
  if (ipRecord && ipRecord.lockUntil > now) {
    const remainingMins = Math.ceil((ipRecord.lockUntil - now) / 60000);
    return NextResponse.json({
      error: `تم حظر المحاولات مؤقتاً لهذا العنوان بسبب تكرار الأخطاء. يرجى الانتظار ${remainingMins} دقيقة.`,
    }, { status: 429 });
  }
  return null;
}

function publicUser(user: any, pcPrint: string, clientIp: string): {
  id: string;
  name: string;
  email: string;
  username: string;
  role: ReturnType<typeof normalizeLoginRole>;
  roleName: string;
  status: string;
  phone: string;
  code: string;
  staffId: string;
  avatar?: string;
  lastLoginIp: string;
  pcFingerprint: string;
  redirect: AppRedirectPath;
} {
  const role = normalizeLoginRole(user.role, { email: user.email, roleName: user.roleName });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role,
    roleName: user.roleName || LOGIN_ROLE_LABELS[role],
    status: user.status,
    phone: user.phone,
    code: user.code,
    staffId: user.staffId,
    avatar: user.avatar,
    lastLoginIp: clientIp,
    pcFingerprint: pcPrint,
    redirect: postLoginPath(role),
  };
}

function completeLogin(user: any, reqMeta: { clientIp: string; userAgent: string; pcPrint: string }) {
  user.lastLoginIp = reqMeta.clientIp;
  user.pcFingerprint = reqMeta.pcPrint;

  const sqlite = getSqliteDb();
  sqlite.prepare('UPDATE users SET lastLoginIp = ?, pcFingerprint = ? WHERE id = ?')
    .run(reqMeta.clientIp, reqMeta.pcPrint, user.id);

  if (needsPasswordRehash(user.passwordHash) && user.__plainPassword) {
    sqlite.prepare('UPDATE users SET passwordHash = ? WHERE id = ?')
      .run(hashPassword(user.__plainPassword), user.id);
  }

  try {
    upsertUserSession({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      ip: reqMeta.clientIp,
      pcPrint: reqMeta.pcPrint,
      userAgent: reqMeta.userAgent,
    });
  } catch (saveErr: any) {
    console.warn('[Session Save Notice]:', saveErr?.message);
  }

  failedAttemptsMap.delete(reqMeta.clientIp);
  const safeUser = publicUser(user, reqMeta.pcPrint, reqMeta.clientIp);
  const waiting = safeUser.role === 'PILGRIM_USER' ? pilgrimWaitingRedirect(user.id) : null;
  if (waiting) safeUser.redirect = waiting.redirect;
  else if (safeUser.role === 'PILGRIM_USER') safeUser.redirect = '/portal';
  const appointment = safeUser.role === 'PILGRIM_USER' && !waiting ? pilgrimAppointment(user.id) : null;
  const token = signToken({
    id: user.id,
    code: user.code || user.username || user.id,
    name: user.name,
    role: user.role,
    roleName: safeUser.roleName,
    email: user.email,
    username: user.username,
    phone: user.phone,
  });

  try {
    dbLogAudit(user.name, user.role, 'تسجيل دخول ناجح', `username=${user.username || user.email}`, reqMeta.clientIp);
  } catch {
    /* login must succeed even if the audit table is old */
  }

  const res = NextResponse.json({
    status: 'SUCCESS',
    user: safeUser,
    token,
    waitingBooking: Boolean(waiting),
    appointment,
  });
  res.cookies.set('south_street_token', token, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return res;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, username, password, fileKey, website_hp, qrPayload } = body;
    const identifier = (username || email || '').trim();

    if (website_hp && String(website_hp).trim().length > 0) {
      return NextResponse.json({ error: 'تم حظر الطلب' }, { status: 403 });
    }

    const meta = clientMeta(req);
    if (!superAdminReady) {
      try {
        repairSuperAdminLogin();
      } catch (repairErr: any) {
        console.warn('[Admin repair]:', repairErr?.message);
      }
      superAdminReady = true;
    }
    const locked = lockoutResponse(meta.clientIp);
    if (locked) return locked;

    let user: any = null;

    if (qrPayload) {
      const found = findUserByQr(String(qrPayload));
      if (!found) {
        recordFailure(meta.clientIp, 'رمز QR غير صالح', meta.userAgent);
        dbLogAudit('Unknown', 'unknown', 'فشل دخول QR', meta.clientIp);
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
          (sqlite.prepare('SELECT * FROM users WHERE email = ?').get(String(identifier).toLowerCase()) as any);
      }
      if (!user || !verifyPassword(String(password), user.passwordHash || user.password_hash)) {
        recordFailure(meta.clientIp, 'اسم مستخدم أو كلمة مرور خاطئة', meta.userAgent);
        return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
      }
      user.__plainPassword = String(password);
    }

    if (user.loginEnabled === 0 || user.loginEnabled === false) {
      return NextResponse.json({ error: 'تم إيقاف صلاحية الدخول لهذا الحساب' }, { status: 403 });
    }

    const role = normalizeLoginRole(user.role, { email: user.email, roleName: user.roleName });

    if (requiresSecurityKey(role)) {
      const db = getDatabase();
      const cleanKey = String(fileKey || '').trim();
      const currentSecurityKey = db.securityKey || 'SOUTHSTREET-KEY-v1-9F8E7D6C5B4A3928';
      if (!cleanKey) {
        return NextResponse.json({
          status: 'REQUIRES_FILE_KEY',
          message: 'دخول الإدارة يتطلب ملف مفتاح الأمان.',
          userRole: role,
          username: user.username,
          email: user.email,
          ip: meta.clientIp,
          pcPrint: meta.pcPrint,
        });
      }
      const isKeyValid = cleanKey === currentSecurityKey || cleanKey.includes(currentSecurityKey);
      if (!isKeyValid) {
        recordFailure(meta.clientIp, 'مفتاح أمان خاطئ', meta.userAgent);
        return NextResponse.json({ error: 'مفتاح الأمان غير صحيح' }, { status: 403 });
      }
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

    if (user.status === 'REJECTED' || user.status === 'SUSPENDED' || user.loginEnabled === 0) {
      return NextResponse.json({ error: 'تم تعليق هذا الحساب من طرف الإدارة.' }, { status: 403 });
    }

    return completeLogin(user, meta);
  } catch (error: any) {
    console.error('[Auth Route Error]:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'خطأ في معالجة طلب الدخول' }, { status: 500 });
  }
}

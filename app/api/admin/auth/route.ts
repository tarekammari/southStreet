import { NextResponse } from 'next/server';
import { getDatabase, saveDatabase, ActiveSession } from '@/lib/db';
import { getSqliteDb } from '@/lib/sqlite';
import { hashPassword, verifyPassword, needsPasswordRehash, generateDeviceFingerprint } from '@/lib/security';
import { findUserForLogin, findUserByQr, queueAccessRequest, repairSuperAdminLogin } from '@/lib/accounts';
import { signToken } from '@/lib/auth';
import { normalizeLoginRole, postLoginPath, requiresSecurityKey, LOGIN_ROLE_LABELS } from '@/lib/roles';
import { dbLogAudit } from '@/lib/db';

const failedAttemptsMap = new Map<string, { count: number; lockUntil: number }>();
let superAdminReady = false;

function isLocalDev(ip: string) {
  const n = (ip || '').trim().toLowerCase();
  if (process.env.NODE_ENV !== 'production') return true;
  return n === '127.0.0.1' || n === '::1' || n === 'localhost' || n.startsWith('::ffff:127.');
}

function clientMeta(req: Request) {
  const headers = req.headers;
  const clientIp = headers.get('x-forwarded-for')?.split(',')[0] || headers.get('x-real-ip') || '127.0.0.1';
  const userAgent = headers.get('user-agent') || 'Mozilla/5.0';
  const acceptLang = headers.get('accept-language') || 'ar-DZ';
  const { pcPrint } = generateDeviceFingerprint(clientIp, userAgent, acceptLang);
  return { clientIp, userAgent, pcPrint };
}

function recordFailure(ip: string) {
  if (isLocalDev(ip)) return;
  const now = Date.now();
  const rec = failedAttemptsMap.get(ip) || { count: 0, lockUntil: 0 };
  rec.count += 1;
  if (rec.count >= 5) rec.lockUntil = now + 15 * 60 * 1000;
  failedAttemptsMap.set(ip, rec);
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

function publicUser(user: any, pcPrint: string, clientIp: string) {
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
    lastLoginIp: clientIp,
    pcFingerprint: pcPrint,
    redirect: postLoginPath(role),
  };
}

function completeLogin(user: any, reqMeta: { clientIp: string; userAgent: string; pcPrint: string }) {
  const db = getDatabase();
  user.lastLoginIp = reqMeta.clientIp;
  user.pcFingerprint = reqMeta.pcPrint;

  const sqlite = getSqliteDb();
  sqlite.prepare('UPDATE users SET lastLoginIp = ?, pcFingerprint = ? WHERE id = ?')
    .run(reqMeta.clientIp, reqMeta.pcPrint, user.id);

  if (needsPasswordRehash(user.passwordHash) && user.__plainPassword) {
    sqlite.prepare('UPDATE users SET passwordHash = ? WHERE id = ?')
      .run(hashPassword(user.__plainPassword), user.id);
  }

  const newSession: ActiveSession = {
    id: `sess_${Date.now()}`,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
    ip: reqMeta.clientIp,
    pcPrint: reqMeta.pcPrint,
    userAgent: reqMeta.userAgent,
    loginTime: new Date().toISOString(),
    lastActive: new Date().toISOString(),
  };

  try {
    db.sessions = [newSession, ...(db.sessions || []).filter((s) => s.userId !== user.id).slice(0, 15)];
    const match = db.users.find((u) => u.id === user.id);
    if (match) {
      match.lastLoginIp = reqMeta.clientIp;
      match.pcFingerprint = reqMeta.pcPrint;
    }
    saveDatabase(db);
  } catch (saveErr: any) {
    console.warn('[Session Save Notice]:', saveErr?.message);
  }

  failedAttemptsMap.delete(reqMeta.clientIp);
  const safeUser = publicUser(user, reqMeta.pcPrint, reqMeta.clientIp);
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
    dbLogAudit(user.name, user.role, 'تسجيل دخول ناجح', `username=${user.username || user.email}`);
  } catch {
    /* login must succeed even if the audit table is old */
  }

  return NextResponse.json({
    status: 'SUCCESS',
    user: safeUser,
    token,
  });
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
        recordFailure(meta.clientIp);
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
        recordFailure(meta.clientIp);
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
      const isKeyValid =
        cleanKey.includes(currentSecurityKey) ||
        currentSecurityKey.includes(cleanKey) ||
        cleanKey.includes('SOUTHSTREET-KEY-v1-') ||
        cleanKey.includes('SOUTHSTREET SECURITY KEY BLOCK');
      if (!isKeyValid) {
        recordFailure(meta.clientIp);
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
        message: 'حسابك في انتظار موافقة الإدارة وتحديد صلاحيتك.',
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

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { ensureUserAccount, updateUserAccess } from '@/lib/accounts';
import { getSqliteDb } from '@/lib/sqlite';
import { normalizeLoginRole, LOGIN_ROLE_LABELS, toPortalRole, PORTAL_TABS } from '@/lib/roles';

function publicUser(u: any) {
  const role = normalizeLoginRole(u.role, { email: u.email, roleName: u.roleName });
  const portal = toPortalRole(role);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    role,
    roleName: u.roleName || LOGIN_ROLE_LABELS[role],
    status: u.status || 'APPROVED',
    createdAt: u.createdAt,
    lastLoginIp: u.lastLoginIp || 'N/A',
    pcFingerprint: u.pcFingerprint || 'FP-SYSTEM-INIT',
    staffId: u.staffId,
    loginEnabled: u.loginEnabled !== false && u.loginEnabled !== 0,
    googleLinked: Boolean(u.googleId || u.google_id),
    options: PORTAL_TABS[portal].map((t) => t.label),
  };
}

export async function GET() {
  try {
    const overlay = getDatabase();
    const sqlite = getSqliteDb();
    const rows = sqlite.prepare('SELECT * FROM users').all() as any[];
    return NextResponse.json({
      users: rows.map(publicUser),
      sessions: overlay.sessions,
      accessRequests: overlay.accessRequests,
      securityKey: overlay.securityKey
    });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في جلب بيانات المستخدمين' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, email, password, role, status, username, phone } = await req.json();

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    const cleanRole = normalizeLoginRole(role || 'PILGRIM_USER');
    const cleanStatus = status || 'APPROVED';

    if (!cleanName || (!cleanEmail && !username) || !cleanPassword) {
      return NextResponse.json({ error: 'الاسم وكلمة المرور واسم المستخدم أو البريد مطلوبة' }, { status: 400 });
    }

    const issued = ensureUserAccount({
      name: cleanName,
      email: cleanEmail || undefined,
      username,
      password: cleanPassword,
      role: cleanRole,
      roleName: LOGIN_ROLE_LABELS[cleanRole],
      phone,
      status: cleanStatus,
      issueSecrets: true,
    });

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء الحساب مع اسم المستخدم وكلمة المرور ورمز QR',
      user: publicUser({
        ...issued,
        status: cleanStatus,
        createdAt: new Date().toISOString(),
      }),
      credentials: {
        username: issued.username,
        password: issued.password,
        qrPayload: issued.qrPayload,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'خطأ في إنشاء الحساب' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId, status, role, roleName, loginEnabled } = await req.json();

    if (!userId || (!status && !role && loginEnabled == null)) {
      return NextResponse.json({ error: 'معرف المستخدم وتحديث الحالة أو الصلاحية مطلوبان' }, { status: 400 });
    }

    const sqlite = getSqliteDb();
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    const nextRole = role ? normalizeLoginRole(role) : undefined;
    const nextStatus = status || undefined;
    const enabled =
      loginEnabled != null
        ? (loginEnabled ? 1 : 0)
        : nextStatus === 'APPROVED'
          ? 1
          : nextStatus === 'REJECTED' || nextStatus === 'SUSPENDED'
            ? 0
            : undefined;

    updateUserAccess(userId, {
      status: nextStatus,
      role: nextRole,
      roleName: roleName || (nextRole ? LOGIN_ROLE_LABELS[nextRole] : undefined),
      loginEnabled: enabled,
    });

    const updated = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    return NextResponse.json({
      success: true,
      message: nextStatus === 'APPROVED'
        ? 'تمت الموافقة وتحديد الصلاحية. يمكن للعضو الدخول الآن.'
        : `تم تحديث حالة الحساب إلى (${nextStatus || nextRole}) بنجاح`,
      user: publicUser(updated),
    });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في تحديث صلاحية الحساب' }, { status: 500 });
  }
}

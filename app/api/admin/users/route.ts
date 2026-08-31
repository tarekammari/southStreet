import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { ensureUserAccount, updateUserAccess } from '@/lib/accounts';
import { getSqliteDb } from '@/lib/sqlite';
import { normalizeLoginRole, LOGIN_ROLE_LABELS, toPortalRole, PORTAL_TABS } from '@/lib/roles';
import { enrichUsersWithSessions, isImageSource, resolveUserPhoto } from '@/lib/user-access-view';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { generateDeviceFingerprint } from '@/lib/security';
import { resolveRequestIp } from '@/lib/security-threats';
import { listSessions, upsertUserSession } from '@/lib/presence';
import { getIpSummaries } from '@/lib/security-monitor';

/** Staff members carry the real portrait; users only link to them through staffId. */
function loadStaffPhotos(sqlite: any): Map<string, string> {
  const photos = new Map<string, string>();
  try {
    const staff = sqlite.prepare('SELECT morshid_id, image, avatar FROM morshids').all() as any[];
    for (const member of staff) {
      const src = isImageSource(member?.image)
        ? member.image
        : isImageSource(member?.avatar)
          ? member.avatar
          : '';
      if (src) photos.set(member.morshid_id, String(src).trim());
    }
  } catch {
    /* staff table unavailable — everyone falls back to the default portrait */
  }
  return photos;
}

function publicUser(u: any, staffPhotos?: Map<string, string>) {
  const role = normalizeLoginRole(u.role, { email: u.email, roleName: u.roleName });
  const portal = toPortalRole(role);
  const photo = resolveUserPhoto(u.avatar, u.staffId ? staffPhotos?.get(u.staffId) : undefined);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    photo,
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

export async function GET(req: NextRequest) {
  try {
    const overlay = getDatabase();
    const sqlite = getSqliteDb();

    const token = getTokenFromRequest(req);
    const payload = token ? verifyToken(token) : null;
    if (payload?.sub) {
      const ip = resolveRequestIp({
        forwarded: req.headers.get('x-forwarded-for'),
        realIp: req.headers.get('x-real-ip'),
        fallback: '127.0.0.1',
      });
      const userAgent = req.headers.get('user-agent') || 'Mozilla/5.0';
      const acceptLang = req.headers.get('accept-language') || 'ar-DZ';
      const { pcPrint } = generateDeviceFingerprint(ip, userAgent, acceptLang);
      try {
        upsertUserSession({
          userId: payload.sub,
          userName: payload.name || '',
          userEmail: payload.email || '',
          userRole: String(payload.role || ''),
          ip,
          pcPrint,
          userAgent,
        });
      } catch {
        /* presence is best-effort */
      }
    }

    const rows = sqlite.prepare('SELECT * FROM users').all() as any[];
    const staffPhotos = loadStaffPhotos(sqlite);
    const sessions = listSessions();
    const users = enrichUsersWithSessions(
      rows.map((row) => publicUser(row, staffPhotos)),
      sessions
    );
    const onlineCount = users.filter((u) => u.isOnline).length;
    const pendingCount = users.filter((u) => u.status === 'PENDING_APPROVAL').length;
    const suspendedCount = users.filter((u) => u.status === 'SUSPENDED' || u.loginEnabled === false).length;
    const neverLoggedIn = users.filter((u) => !u.lastLogin).length;
    const liveIps = getIpSummaries(12);

    return NextResponse.json({
      users,
      sessions,
      liveIps,
      accessRequests: overlay.accessRequests,
      securityKey: overlay.securityKey,
      serverTime: new Date().toISOString(),
      stats: {
        total: users.length,
        online: onlineCount,
        pending: pendingCount,
        suspended: suspendedCount,
        active: users.filter((u) => u.status === 'APPROVED' && u.loginEnabled !== false).length,
        sessions: sessions.length,
        neverLoggedIn,
        liveIps: liveIps.length,
      },
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
      user: publicUser(updated, loadStaffPhotos(sqlite)),
    });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في تحديث صلاحية الحساب' }, { status: 500 });
  }
}

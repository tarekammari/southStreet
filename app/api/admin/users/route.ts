import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { ensureUserAccount, updateUserAccess, updateUserProfile, deleteUserAccount } from '@/lib/accounts';
import { getSqliteDb } from '@/lib/sqlite';
import { normalizeLoginRole, LOGIN_ROLE_LABELS, toPortalRole, PORTAL_TABS, isPrivilegedRole } from '@/lib/roles';
import { enrichUsersWithSessions, isImageSource, resolveUserPhoto } from '@/lib/user-access-view';
import { generateDeviceFingerprint } from '@/lib/security';
import { resolveRequestIp } from '@/lib/security-threats';
import { listSessions, upsertUserSession } from '@/lib/presence';
import { getIpSummaries } from '@/lib/security-monitor';
import { collectUserHistory } from '@/lib/user-activity';
import { dbLogAudit } from '@/lib/db';
import { ADMINS, requireRole, requireStepUp, type GateOk } from '@/lib/staff-gate';
import { assignableRoles, canManage, type TargetAction } from '@/lib/permissions';
import { appOrigin, bumpTokenVersion, countCredentials, createEnrollmentToken, resetSecurityFactors } from '@/lib/webauthn';

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
  // never expose password hashes or security material
  const role = normalizeLoginRole(u.role);
  const portal = toPortalRole(role);
  const photo = resolveUserPhoto(u.avatar, u.staffId ? staffPhotos?.get(u.staffId) : undefined);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    phone: u.phone || '',
    photo,
    role,
    roleName: LOGIN_ROLE_LABELS[role],
    status: u.status || 'APPROVED',
    createdAt: u.createdAt,
    lastLoginIp: u.lastLoginIp || 'N/A',
    pcFingerprint: u.pcFingerprint || 'FP-SYSTEM-INIT',
    staffId: u.staffId,
    loginEnabled: u.loginEnabled !== false && u.loginEnabled !== 0,
    googleLinked: Boolean(u.googleId || u.google_id),
    options: PORTAL_TABS[portal].map((t) => t.label),
    privileged: isPrivilegedRole(role),
    securityKeys: isPrivilegedRole(role) && u.id ? countCredentials(u.id) : 0,
  };
}

/** Applies a lib/permissions decision; dangerous actions also need a fresh key tap. */
function authorize(req: NextRequest, gate: GateOk, target: any, action: TargetAction): NextResponse | null {
  const decision = canManage({ id: gate.account.id, role: gate.role }, { id: target.id, role: target.role }, action);
  if (!decision.ok) return NextResponse.json({ error: decision.reason }, { status: 403 });
  if (decision.stepUp) {
    const stepUp = requireStepUp(req, gate);
    if (stepUp) return stepUp.error;
  }
  return null;
}

function friendlyError(error: any, fallback: string): string {
  const msg = String(error?.message || '');
  if (msg.includes('SINGLE_SUPER_ADMIN') || msg === 'SUPER_ADMIN_PROTECTED') return 'لا يوجد في النظام إلا مشرف عام واحد';
  if (msg === 'PRIVILEGED_PROTECTED') return 'حسابات المشرفين تُدار من المشرف العام فقط';
  // Arabic messages from lib/accounts are safe to show; anything else stays generic.
  return /[\u0600-\u06FF]/.test(msg) ? msg : fallback;
}

const INVITE_TTL_MINUTES = 24 * 60;

function inviteFor(req: NextRequest, gate: GateOk, userId: string, reason: 'invite' | 'reset') {
  const token = createEnrollmentToken(userId, reason, gate.account.name || gate.account.id, INVITE_TTL_MINUTES);
  return { url: `${appOrigin(req)}/enroll?t=${encodeURIComponent(token)}`, expiresInMinutes: INVITE_TTL_MINUTES };
}

export async function GET(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const overlay = getDatabase();
    const sqlite = getSqliteDb();

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
        userId: gate.account.id,
        userName: gate.account.name || '',
        userEmail: gate.account.email || '',
        userRole: gate.role,
        ip,
        pcPrint,
        userAgent,
      });
    } catch {
      /* presence is best-effort */
    }

    const activityFor = req.nextUrl.searchParams.get('activityFor');
    if (activityFor) {
      return NextResponse.json(collectUserHistory(activityFor));
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
      viewer: { id: gate.account.id, role: gate.role, assignableRoles: assignableRoles(gate.role) },
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
  } catch {
    return NextResponse.json({ error: 'خطأ في جلب بيانات المستخدمين' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const body = await req.json().catch(() => ({}));
    const cleanName = String(body.name || '').trim().slice(0, 120);
    const cleanEmail = String(body.email || '').trim().toLowerCase().slice(0, 160);
    const cleanUsername = String(body.username || '').trim().slice(0, 60);
    const cleanPhone = String(body.phone || '').trim().slice(0, 40);
    const cleanPassword = String(body.password || '').trim();
    const cleanRole = normalizeLoginRole(String(body.role || 'PILGRIM_USER'));
    const cleanStatus = ['APPROVED', 'PENDING_APPROVAL', 'SUSPENDED'].includes(body.status) ? body.status : 'APPROVED';

    if (!assignableRoles(gate.role).includes(cleanRole)) {
      return NextResponse.json({ error: 'لا تملك صلاحية إنشاء حساب بهذا الدور' }, { status: 403 });
    }
    if (!cleanName || (!cleanEmail && !cleanUsername)) {
      return NextResponse.json({ error: 'الاسم واسم المستخدم أو البريد مطلوبة' }, { status: 400 });
    }

    // Admin accounts: Super Admin only, confirmed with a key tap. No password is
    // set here — the new Admin sets it on the activation link with their own key.
    if (cleanRole === 'AGENCY_MANAGER') {
      const stepUp = requireStepUp(req, gate);
      if (stepUp) return stepUp.error;
      const issued = ensureUserAccount({
        name: cleanName,
        email: cleanEmail || undefined,
        username: cleanUsername || undefined,
        role: cleanRole,
        roleName: LOGIN_ROLE_LABELS[cleanRole],
        phone: cleanPhone,
        status: 'APPROVED',
        issueSecrets: false,
        allowPrivileged: true,
      });
      dbLogAudit(gate.account.name, gate.role, 'إنشاء حساب مشرف', `${cleanName} (${issued.username})`);
      return NextResponse.json({
        success: true,
        message: 'تم إنشاء حساب المشرف. أرسل له رابط التفعيل ليعيّن كلمة المرور ومفتاح الأمان.',
        user: publicUser({ ...issued, id: issued.userId, role: cleanRole, status: 'APPROVED', createdAt: new Date().toISOString() }),
        invite: inviteFor(req, gate, issued.userId, 'invite'),
      });
    }

    if (cleanPassword && cleanPassword.length < 8) {
      return NextResponse.json({ error: 'كلمة المرور 8 أحرف على الأقل' }, { status: 400 });
    }
    const issued = ensureUserAccount({
      name: cleanName,
      email: cleanEmail || undefined,
      username: cleanUsername || undefined,
      password: cleanPassword || undefined,
      role: cleanRole,
      roleName: LOGIN_ROLE_LABELS[cleanRole],
      phone: cleanPhone,
      status: cleanStatus,
      issueSecrets: true,
    });
    dbLogAudit(gate.account.name, gate.role, 'إنشاء حساب', `${cleanName} — ${LOGIN_ROLE_LABELS[cleanRole]}`);

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء الحساب مع اسم المستخدم وكلمة المرور ورمز QR',
      user: publicUser({ ...issued, id: issued.userId, role: cleanRole, status: cleanStatus, createdAt: new Date().toISOString() }),
      credentials: {
        username: issued.username,
        password: issued.password,
        qrPayload: issued.qrPayload,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: friendlyError(error, 'خطأ في إنشاء الحساب') }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, status, role, loginEnabled, name, email, username, phone, password, action } = body;
    if (!userId) return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 });

    const sqlite = getSqliteDb();
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    const targetRole = normalizeLoginRole(user.role);

    // Activation link / lost-key reset for an Admin (Super Admin + key tap).
    if (action === 'invite-link' || action === 'reset-security') {
      if (targetRole !== 'AGENCY_MANAGER') {
        return NextResponse.json({ error: 'روابط التفعيل لحسابات المشرفين فقط' }, { status: 400 });
      }
      const denied = authorize(req, gate, user, 'security');
      if (denied) return denied;
      if (action === 'reset-security') resetSecurityFactors(user.id);
      dbLogAudit(
        gate.account.name,
        gate.role,
        action === 'reset-security' ? 'إعادة ضبط مفاتيح مشرف' : 'إصدار رابط تفعيل',
        user.name || userId
      );
      return NextResponse.json({
        success: true,
        invite: inviteFor(req, gate, user.id, action === 'reset-security' ? 'reset' : 'invite'),
      });
    }

    const wantsRole = role != null && String(role) !== '' && normalizeLoginRole(role) !== targetRole;
    const wantsAccess = status != null || loginEnabled != null;
    const wantsPassword = password != null && String(password) !== '';
    const wantsProfile = [name, email, username, phone].some((v) => v != null && String(v) !== '');
    if (!wantsRole && !wantsAccess && !wantsPassword && !wantsProfile) {
      return NextResponse.json({ error: 'لا يوجد تحديث' }, { status: 400 });
    }

    const checks: [boolean, TargetAction][] = [
      [wantsProfile, 'profile'],
      [wantsAccess, 'access'],
      [wantsRole, 'role'],
      [wantsPassword, 'password'],
    ];
    for (const [wanted, act] of checks) {
      if (!wanted) continue;
      const denied = authorize(req, gate, user, act);
      if (denied) return denied;
    }

    const nextRole = wantsRole ? normalizeLoginRole(role) : undefined;
    if (nextRole && !assignableRoles(gate.role).includes(nextRole)) {
      return NextResponse.json({ error: 'لا تملك صلاحية منح هذا الدور' }, { status: 403 });
    }
    if (wantsPassword && String(password).length < 8) {
      return NextResponse.json({ error: 'كلمة المرور 8 أحرف على الأقل' }, { status: 400 });
    }

    if (wantsProfile || wantsPassword) {
      updateUserProfile(
        userId,
        { name, email, username, phone, password: wantsPassword ? password : undefined },
        { allowPersonal: gate.account.id === userId }
      );
    }

    if (wantsAccess || nextRole) {
      const nextStatus = ['APPROVED', 'PENDING_APPROVAL', 'SUSPENDED', 'REJECTED'].includes(status) ? status : undefined;
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
        roleName: nextRole ? LOGIN_ROLE_LABELS[nextRole] : undefined,
        loginEnabled: enabled,
      });
    }

    // Entering or leaving the Admin role wipes keys (fresh enrollment needed);
    // any role / access / password change ends the account's open sessions.
    if (nextRole === 'AGENCY_MANAGER' || (nextRole && targetRole === 'AGENCY_MANAGER')) resetSecurityFactors(userId);
    else if (nextRole || wantsAccess || wantsPassword) bumpTokenVersion(userId);

    dbLogAudit(
      gate.account.name,
      gate.role,
      nextRole ? 'تغيير دور حساب' : 'تحديث حساب',
      `${user.name || userId}${nextRole ? ` → ${LOGIN_ROLE_LABELS[nextRole]}` : ''}`
    );

    const updated = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const invite = nextRole === 'AGENCY_MANAGER' ? inviteFor(req, gate, userId, 'invite') : undefined;
    return NextResponse.json({
      success: true,
      message: invite ? 'أصبح الحساب مشرفاً. أرسل له رابط التفعيل لتسجيل مفتاح الأمان.' : 'تم حفظ بيانات الحساب',
      user: publicUser(updated, loadStaffPhotos(sqlite)),
      invite,
    });
  } catch (error: any) {
    return NextResponse.json({ error: friendlyError(error, 'خطأ في تحديث الحساب') }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const userId = new URL(req.url).searchParams.get('userId') || '';
    if (!userId) return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 });
    const user = getSqliteDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    const denied = authorize(req, gate, user, 'delete');
    if (denied) return denied;
    resetSecurityFactors(userId);
    deleteUserAccount(userId, gate.account.id);
    dbLogAudit(gate.account.name, gate.role, 'حذف حساب', `${user.name || userId}`);
    return NextResponse.json({ success: true, message: 'تم حذف الحساب' });
  } catch (error: any) {
    return NextResponse.json({ error: friendlyError(error, 'تعذّر حذف الحساب') }, { status: 400 });
  }
}

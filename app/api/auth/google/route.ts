import { NextResponse } from 'next/server';
import { verifyGoogleCredential } from '@/lib/google-id-token';
import {
  attachGoogleId,
  findUserByGoogleId,
  findUserForLogin,
  queueAccessRequest,
  registerSelfAccount,
  saveUserPhoto,
} from '@/lib/accounts';
import { generateDeviceFingerprint } from '@/lib/security';
import { normalizeLoginRole, postLoginPath, LOGIN_ROLE_LABELS } from '@/lib/roles';
import { signToken } from '@/lib/auth';
import { getSqliteDb } from '@/lib/sqlite';
import { pilgrimAppointment, pilgrimWaitingRedirect } from '@/lib/booking';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const profile = await verifyGoogleCredential(String(body.idToken || body.accessToken || ''));

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || '';
    const { pcPrint } = generateDeviceFingerprint(ip, userAgent, req.headers.get('accept-language') || '');

    let user = findUserByGoogleId(profile.googleId) || findUserForLogin(profile.email);

    if (!user) {
      const created = registerSelfAccount({
        name: profile.name,
        username: profile.email.split('@')[0],
        password: '',
        email: profile.email,
        googleId: profile.googleId,
        ip,
        pcPrint,
        userAgent,
      });
      saveUserPhoto(created.userId, profile.picture);
      return NextResponse.json({
        status: 'PENDING_APPROVAL',
        message: 'طلبك قيد المراجعة. سنخبرك بعد تأكيد الوكالة.',
        username: created.username,
        email: profile.email,
        name: profile.name,
      });
    }

    if (!user.googleId && !user.google_id) {
      attachGoogleId(user.id, profile.googleId);
    }
    saveUserPhoto(user.id, profile.picture);
    try {
      const fresh = getSqliteDb().prepare('SELECT avatar FROM users WHERE id = ?').get(user.id) as any;
      if (fresh?.avatar) user.avatar = fresh.avatar;
      else if (profile.picture) user.avatar = profile.picture;
    } catch {
      if (profile.picture) user.avatar = profile.picture;
    }

    const status = user.status || 'APPROVED';
    if (status === 'PENDING_APPROVAL' || status === 'PENDING') {
      queueAccessRequest({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        ip,
        pcPrint,
        userAgent,
      });
      return NextResponse.json({
        status: 'PENDING_APPROVAL',
        message: 'طلبك قيد المراجعة. سنخبرك بعد تأكيد الوكالة.',
        email: profile.email,
        name: profile.name,
      });
    }

    if (status === 'REJECTED' || status === 'SUSPENDED' || user.loginEnabled === 0) {
      return NextResponse.json({ error: 'تم تعليق هذا الحساب من طرف الإدارة.' }, { status: 403 });
    }

    const sqlite = getSqliteDb();
    try {
      sqlite.prepare('UPDATE users SET lastLoginIp = ?, pcFingerprint = ? WHERE id = ?')
        .run(ip, pcPrint, user.id);
    } catch {
      /* legacy column names */
    }

    const role = normalizeLoginRole(user.role, { email: user.email, roleName: user.roleName });
    const waiting = role === 'PILGRIM_USER' ? pilgrimWaitingRedirect(user.id) : null;
    const appointment = role === 'PILGRIM_USER' && !waiting ? pilgrimAppointment(user.id) : null;
    const token = signToken({
      id: user.id,
      code: user.code || user.username || user.id,
      name: user.name,
      role: user.role,
      roleName: user.roleName || LOGIN_ROLE_LABELS[role],
      email: user.email,
      username: user.username,
      phone: user.phone,
    });

    const res = NextResponse.json({
      status: 'SUCCESS',
      token,
      waitingBooking: Boolean(waiting),
      appointment,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role,
        roleName: user.roleName || LOGIN_ROLE_LABELS[role],
        status,
        phone: user.phone,
        avatar: user.avatar,
        photoUrl: String(user.avatar || '').startsWith('http') ? '/api/account/avatar' : '',
        staffId: user.staffId,
        redirect: waiting?.redirect || (appointment ? '/portal' : postLoginPath(role)),
      },
    });
    res.cookies.set('south_street_token', token, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر الدخول عبر جوجل' }, { status: 400 });
  }
}

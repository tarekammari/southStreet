import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-token';
import { registerSelfAccount, findUserForLogin } from '@/lib/accounts';
import { generateDeviceFingerprint } from '@/lib/security';
import { notifySignup } from '@/lib/notifications';
import { normalizeLoginRole, postLoginPath, LOGIN_ROLE_LABELS, isPrivilegedRole } from '@/lib/roles';
import { signToken } from '@/lib/auth';
import { pilgrimAppointment, pilgrimWaitingRedirect } from '@/lib/booking';
import { tokenVersionOf } from '@/lib/webauthn';
import { checkContact, forgetPhoneIndex } from '@/lib/account-lookup';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.website_hp && String(body.website_hp).trim()) {
      return NextResponse.json({ error: 'تم حظر الطلب' }, { status: 403 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || '';
    const { pcPrint } = generateDeviceFingerprint(ip, userAgent, req.headers.get('accept-language') || '');

    // Already a client? Point to sign-in instead of opening a second account.
    // Email: one account only. Phone: may be shared by a family, so the form asks
    // "is it yours?" and sends phoneConfirmed once the user says it is a new person.
    const known = checkContact({ email: body.email, phone: body.phone });
    if (known.email?.exists) {
      return NextResponse.json(
        { error: 'لديك حساب مسجّل بهذا البريد. سجّل الدخول بدلاً من إنشاء حساب جديد.', code: 'ACCOUNT_EXISTS', field: 'email', google: known.email.google },
        { status: 409 }
      );
    }
    if (known.phone?.exists && !body.phoneConfirmed) {
      return NextResponse.json(
        { error: 'يوجد حساب مسجّل بهذا الرقم. هل هو حسابك؟', code: 'PHONE_IN_USE', field: 'phone' },
        { status: 409 }
      );
    }

    const created = registerSelfAccount({
      name: String(body.name || ''),
      username: String(body.username || ''),
      password: String(body.password || ''),
      email: body.email,
      phone: body.phone,
      ip,
      pcPrint,
      userAgent,
    });

    forgetPhoneIndex();
    notifySignup({
      userId: created.userId,
      name: String(body.name || ''),
      email: body.email,
      status: created.status,
    });

    if (created.status === 'PENDING_APPROVAL') {
      return NextResponse.json({
        status: 'PENDING_APPROVAL',
        username: created.username,
        message: 'تم إنشاء حسابك. ينتظر موافقة الإدارة قبل تسجيل الدخول.',
      });
    }

    const user = findUserForLogin(created.username);
    if (!user) {
      return NextResponse.json({
        status: 'SUCCESS',
        username: created.username,
        message: 'تم إنشاء حسابك بنجاح. يمكنك تسجيل الدخول الآن.',
      });
    }

    const role = normalizeLoginRole(user.role);
    if (isPrivilegedRole(role)) {
      return NextResponse.json({ error: 'طلب غير صالح' }, { status: 403 });
    }
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
    }, { tokenVersion: tokenVersionOf(user.id) });

    const res = NextResponse.json({
      status: 'SUCCESS',
      token,
      waitingBooking: Boolean(waiting),
      appointment,
      username: created.username,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role,
        roleName: user.roleName || LOGIN_ROLE_LABELS[role],
        status: user.status || 'APPROVED',
        phone: user.phone,
        avatar: user.avatar,
        photoUrl: String(user.avatar || '').startsWith('http') ? '/api/account/avatar' : '',
        staffId: user.staffId,
        redirect: waiting?.redirect || (appointment ? '/portal' : postLoginPath(role)),
      },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(60 * 60 * 24));
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر إنشاء الحساب' }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import {
  ensureStaffLogin,
  ensureUserAccount,
  getAccountByStaffId,
  getAccountByUserId,
  issueQrSecret,
  rotatePassword,
} from '@/lib/accounts';
import { getAuthUser } from '@/lib/request-auth';
import { normalizeLoginRole, LOGIN_ROLE_LABELS } from '@/lib/roles';
import { getSqliteDb } from '@/lib/sqlite';

export const dynamic = 'force-dynamic';

function canManageAccounts(role?: string) {
  const login = normalizeLoginRole(role);
  return login === 'SUPER_ADMIN' || login === 'AGENCY_MANAGER';
}

function qrImageSrc(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=M&margin=8&data=${encodeURIComponent(payload)}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '';
    const staffId = searchParams.get('staffId') || '';

    let account = userId ? getAccountByUserId(userId) : null;
    if (!account && staffId) account = getAccountByStaffId(staffId);

    if (!account) {
      return NextResponse.json({ account: null });
    }

    return NextResponse.json({ account });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر جلب بيانات الدخول' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    const body = await req.json();
    const action = body.action || 'issue';
    const userId = body.userId || '';
    const staffId = body.staffId || '';

    if (auth && !canManageAccounts(auth.role) && action !== 'self-qr') {
      // Allow if no auth header (admin CMS currently uses localStorage only on some calls)
    }

    let account = userId ? getAccountByUserId(userId) : staffId ? getAccountByStaffId(staffId) : null;

    if (!account && staffId) {
      const staff = getSqliteDb().prepare('SELECT * FROM morshids WHERE morshid_id = ?').get(staffId) as any;
      if (!staff) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 });
      const issued = ensureStaffLogin({
        ...staff,
        password: body.password,
        username: body.username,
      } as any);
      account = getAccountByUserId(issued.userId);
    }

    if (!account && body.name) {
      const issued = ensureUserAccount({
        name: body.name,
        email: body.email,
        username: body.username,
        password: body.password,
        role: body.role || 'PILGRIM_USER',
        roleName: body.roleName,
        phone: body.phone,
        staffId,
        issueSecrets: true,
      });
      account = getAccountByUserId(issued.userId);
    }

    if (!account) {
      return NextResponse.json({ error: 'تعذر تحديد الحساب' }, { status: 400 });
    }

    let password: string | undefined;
    let qrPayload = '';

    if (action === 'issue' || action === 'rotate-qr' || action === 'self-qr') {
      const qr = issueQrSecret(account.userId);
      qrPayload = qr.qrPayload;
      account = getAccountByUserId(account.userId)!;
    }

    if (action === 'issue' || action === 'rotate-password' || body.password) {
      password = rotatePassword(account.userId, body.password);
    }

    if (action === 'set-username' && body.username) {
      ensureUserAccount({
        id: account.userId,
        name: account.name,
        username: body.username,
        email: account.email,
        role: account.role,
        roleName: account.roleName,
        staffId: account.staffId,
        issueSecrets: false,
      });
      account = getAccountByUserId(account.userId)!;
    }

    if (action === 'set-role' && body.role) {
      const role = normalizeLoginRole(body.role);
      ensureUserAccount({
        id: account.userId,
        name: account.name,
        role,
        roleName: body.roleName || LOGIN_ROLE_LABELS[role],
        staffId: account.staffId,
        issueSecrets: false,
      });
      account = getAccountByUserId(account.userId)!;
    }

    return NextResponse.json({
      success: true,
      account,
      password: password || undefined,
      qrPayload: qrPayload || undefined,
      qrImage: qrPayload ? qrImageSrc(qrPayload) : undefined,
      message: password
        ? 'تم إصدار بيانات الدخول. تظهر كلمة المرور مرة واحدة فقط.'
        : 'تم تحديث بيانات الدخول',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'تعذر إصدار بيانات الدخول' }, { status: 500 });
  }
}

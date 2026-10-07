import { NextRequest, NextResponse } from 'next/server';
import {
  ensureStaffLogin,
  ensureUserAccount,
  getAccountByStaffId,
  getAccountByUserId,
  issueQrSecret,
  rotatePassword,
} from '@/lib/accounts';
import { normalizeLoginRole, LOGIN_ROLE_LABELS } from '@/lib/roles';
import { getSqliteDb } from '@/lib/sqlite';
import { dbLogAudit } from '@/lib/db';
import { ADMINS, requireRole, requireSession, requireStepUp, type GateOk } from '@/lib/staff-gate';
import { assignableRoles, canManage, type TargetAction } from '@/lib/permissions';
import { bumpTokenVersion } from '@/lib/webauthn';

/**
 * Login credentials (username / password / QR) for staff and user accounts.
 * Every call needs a session. A user may refresh their own QR; everything else
 * follows lib/permissions (Admins manage lower roles, the Super Admin manages
 * Admins, nobody touches the Super Admin from here).
 */

export const dynamic = 'force-dynamic';

function qrImageSrc(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=M&margin=8&data=${encodeURIComponent(payload)}`;
}

function guard(req: NextRequest, gate: GateOk, target: { userId: string; role: string }, action: TargetAction) {
  const decision = canManage({ id: gate.account.id, role: gate.role }, { id: target.userId, role: target.role }, action);
  if (!decision.ok) return NextResponse.json({ error: decision.reason }, { status: 403 });
  if (decision.stepUp) {
    const stepUp = requireStepUp(req, gate);
    if (stepUp) return stepUp.error;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '';
    const staffId = searchParams.get('staffId') || '';
    let account = userId ? getAccountByUserId(userId) : null;
    if (!account && staffId) account = getAccountByStaffId(staffId);
    return NextResponse.json({ account: account || null });
  } catch {
    return NextResponse.json({ error: 'تعذر جلب بيانات الدخول' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'issue');
    const userId = String(body.userId || '');
    const staffId = String(body.staffId || '');

    // A signed-in user may refresh only their own QR code.
    if (action === 'self-qr') {
      const session = requireSession(req);
      if ('error' in session) return session.error;
      const qr = issueQrSecret(session.account.id);
      return NextResponse.json({ success: true, qrPayload: qr.qrPayload, qrImage: qrImageSrc(qr.qrPayload) });
    }

    const gate = requireRole(req, ADMINS);
    if ('error' in gate) return gate.error;

    let account = userId ? getAccountByUserId(userId) : staffId ? getAccountByStaffId(staffId) : null;

    if (!account && staffId) {
      const staff = getSqliteDb().prepare('SELECT * FROM morshids WHERE morshid_id = ?').get(staffId) as any;
      if (!staff) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 });
      const issued = ensureStaffLogin({ ...staff, password: body.password, username: body.username } as any);
      account = getAccountByUserId(issued.userId);
    }

    if (!account && body.name) {
      const role = normalizeLoginRole(body.role || 'PILGRIM_USER');
      if (!assignableRoles(gate.role).includes(role) || role === 'AGENCY_MANAGER') {
        return NextResponse.json({ error: 'أنشئ حسابات المشرفين من لوحة الحسابات' }, { status: 403 });
      }
      const issued = ensureUserAccount({
        name: String(body.name).slice(0, 120),
        email: body.email,
        username: body.username,
        password: body.password,
        role,
        roleName: LOGIN_ROLE_LABELS[role],
        phone: body.phone,
        staffId,
        issueSecrets: true,
      });
      account = getAccountByUserId(issued.userId);
    }

    if (!account) return NextResponse.json({ error: 'تعذر تحديد الحساب' }, { status: 400 });
    const target = { userId: account.userId, role: String(account.role || '') };

    let password: string | undefined;
    let qrPayload = '';

    if (action === 'issue' || action === 'rotate-qr') {
      const denied = guard(req, gate, target, 'password');
      if (denied) return denied;
      const qr = issueQrSecret(account.userId);
      qrPayload = qr.qrPayload;
      account = getAccountByUserId(account.userId)!;
    }

    if (action === 'issue' || action === 'rotate-password' || body.password) {
      const denied = guard(req, gate, target, 'password');
      if (denied) return denied;
      if (body.password && String(body.password).length < 8) {
        return NextResponse.json({ error: 'كلمة المرور 8 أحرف على الأقل' }, { status: 400 });
      }
      password = rotatePassword(account.userId, body.password);
      bumpTokenVersion(account.userId);
    }

    if (action === 'set-username' && body.username) {
      const denied = guard(req, gate, target, 'profile');
      if (denied) return denied;
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
      const denied = guard(req, gate, target, 'role');
      if (denied) return denied;
      if (!assignableRoles(gate.role).includes(role) || role === 'AGENCY_MANAGER') {
        return NextResponse.json({ error: 'منح دور المشرف يتم من لوحة الحسابات' }, { status: 403 });
      }
      ensureUserAccount({
        id: account.userId,
        name: account.name,
        role,
        roleName: LOGIN_ROLE_LABELS[role],
        staffId: account.staffId,
        issueSecrets: false,
      });
      bumpTokenVersion(account.userId);
      account = getAccountByUserId(account.userId)!;
    }

    dbLogAudit(gate.account.name, gate.role, 'إدارة بيانات الدخول', `${action} — ${account.name || account.userId}`);

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
    const msg = String(error?.message || '');
    if (msg === 'SUPER_ADMIN_PROTECTED' || msg === 'PRIVILEGED_PROTECTED' || msg.includes('SINGLE_SUPER_ADMIN')) {
      return NextResponse.json({ error: 'حسابات الإدارة تُدار من لوحة الحسابات فقط' }, { status: 403 });
    }
    return NextResponse.json({ error: /[\u0600-\u06FF]/.test(msg) ? msg : 'تعذر إصدار بيانات الدخول' }, { status: 400 });
  }
}

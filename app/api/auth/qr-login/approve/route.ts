import { NextResponse } from 'next/server';
import { requireSession, requireStepUp } from '@/lib/staff-gate';
import { clientMeta } from '@/lib/login-session';
import { dbLogAudit } from '@/lib/db';
import { ensureUserAccount } from '@/lib/accounts';
import { recordLoginIncident } from '@/lib/security-monitor';
import { deviceLabel } from '@/lib/user-access-view';
import { isPrivilegedRole, LOGIN_ROLE_LABELS, normalizeLoginRole } from '@/lib/roles';
import {
  approveQrRequest,
  denyQrRequest,
  isQrTargetRole,
  qrTargetAccount,
  requestForApprover,
  type QrTargetRole,
} from '@/lib/qr-login';

export const dynamic = 'force-dynamic';

/**
 * A phone answers the sign-in request it scanned.
 *   { id, decision: 'deny' }                                → the device is refused.
 *   { id, decision: 'approve', number, role, userId? }      → the number must be
 *     the one the device shows. The Super Admin chooses the account and confirms
 *     with a security-key step-up (x-step-up); any other account opens itself.
 *   { …, role, newAccount: { name, phone? } }               → the Super Admin
 *     creates an accountant / guide / pilgrim account on the spot (the agency
 *     has none yet) and the device opens it; its sign-in details come back once.
 */
export async function POST(req: Request) {
  const gate = requireSession(req);
  if ('error' in gate) return gate.error;
  const superAdmin = gate.role === 'SUPER_ADMIN';
  if (!superAdmin && isPrivilegedRole(gate.role)) {
    return NextResponse.json({ error: 'حساب المشرف يدخل إلى الأجهزة بمفتاح الأمان فقط.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const meta = clientMeta(req);

  const row = requestForApprover(String(body.id || ''), gate.account.id);
  if (!row) return NextResponse.json({ error: 'الطلب غير موجود.' }, { status: 404 });
  if (row.status !== 'scanned') {
    return NextResponse.json({ error: 'انتهت صلاحية الطلب. حدّث الرمز على الجهاز وامسحه مجدداً.', code: 'EXPIRED' }, { status: 410 });
  }
  const device = `${deviceLabel(row.device_ua)} · ${row.device_ip}`;

  if (body.decision === 'deny') {
    denyQrRequest(row);
    dbLogAudit(gate.account.name, gate.account.role, 'رفض دخول جهاز عبر QR', device, meta.clientIp);
    return NextResponse.json({ ok: true, status: 'denied' });
  }

  const role = superAdmin ? String(body.role || '') : 'SELF';
  const newName = String(body.newAccount?.name || '').trim().slice(0, 120);
  const newPhone = String(body.newAccount?.phone || '').trim().slice(0, 40);
  const creating = superAdmin && body.newAccount && role !== 'SUPER_ADMIN';
  if (creating && newName.length < 2) return NextResponse.json({ error: 'اكتب اسم صاحب الحساب.' }, { status: 400 });

  // Nothing changes until the key is tapped: the first call (without it) only asks for it.
  if (superAdmin) {
    const stepUp = requireStepUp(req, gate);
    if (stepUp) return stepUp.error;
  }

  if (Number(body.number) !== row.pair_number) {
    denyQrRequest(row);
    dbLogAudit(gate.account.name, gate.account.role, 'رفض دخول جهاز عبر QR — رقم غير مطابق', device, meta.clientIp);
    try {
      recordLoginIncident({ ip: row.device_ip, userAgent: row.device_ua, reason: 'ربط جهاز عبر QR: الرقم المختار لا يطابق الجهاز' });
    } catch {
      /* monitoring must not break the answer */
    }
    return NextResponse.json(
      { error: 'الرقم لا يطابق الرقم الظاهر على الجهاز، فأُلغي الطلب. إن لم يكن الجهاز أمامك فلا تمسح رموزه.', code: 'WRONG_NUMBER' },
      { status: 409 }
    );
  }

  if (superAdmin && !isQrTargetRole(role)) return NextResponse.json({ error: 'اختر الدور.' }, { status: 400 });

  let issued: { username: string; password?: string } | null = null;
  let target: any = null;
  if (!superAdmin || role === 'SUPER_ADMIN') {
    target = gate.account;
  } else if (creating) {
    try {
      const created = ensureUserAccount({
        name: newName,
        phone: newPhone || undefined,
        role,
        roleName: LOGIN_ROLE_LABELS[role as QrTargetRole],
        status: 'APPROVED',
        issueSecrets: true,
      });
      issued = { username: created.username, password: created.password };
      target = qrTargetAccount(created.userId, role as QrTargetRole);
      dbLogAudit(gate.account.name, gate.role, 'إنشاء حساب', `${newName} — ${LOGIN_ROLE_LABELS[role as QrTargetRole]} (من الهاتف عبر QR)`, meta.clientIp);
    } catch {
      return NextResponse.json({ error: 'تعذّر إنشاء الحساب.' }, { status: 400 });
    }
  } else {
    target = qrTargetAccount(String(body.userId || ''), role as QrTargetRole);
  }
  if (!target) return NextResponse.json({ error: 'الحساب غير متاح أو موقوف.' }, { status: 404 });

  if (!approveQrRequest(row, target.id)) {
    return NextResponse.json(
      { error: 'انتهت صلاحية الطلب. حدّث الرمز على الجهاز.', code: 'EXPIRED', credentials: issued },
      { status: 410 }
    );
  }
  dbLogAudit(
    gate.account.name,
    gate.account.role,
    superAdmin ? 'فتح جلسة على جهاز جديد عبر QR' : 'دخول جهاز بمسح QR من الهاتف',
    `${LOGIN_ROLE_LABELS[normalizeLoginRole(target.role)]}: ${target.name} — ${device}`,
    meta.clientIp
  );
  return NextResponse.json({
    ok: true,
    status: 'approved',
    account: { name: target.name, role: normalizeLoginRole(target.role) },
    // A new account's sign-in details, shown once on the phone to hand over.
    credentials: issued,
  });
}

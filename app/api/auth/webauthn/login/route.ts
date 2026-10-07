import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { isPrivilegedRole, normalizeLoginRole } from '@/lib/roles';
import { dbLogAudit } from '@/lib/db';
import { clientMeta, completeLogin, lockoutResponse, recordLoginFailure } from '@/lib/login-session';
import { consumeRecoveryCode, finishAuthentication, readFlowToken, remainingRecoveryCodes } from '@/lib/webauthn';

/**
 * Step 2 of Super Admin / Admin sign-in: a security-key assertion, or a
 * one-time recovery code, bound to the flow token issued by the password step.
 */
export async function POST(req: Request) {
  const meta = clientMeta(req);
  const locked = lockoutResponse(meta);
  if (locked) return locked;

  try {
    const body = await req.json().catch(() => ({}));
    const flowToken = String(body.flowToken || '');
    const flow = readFlowToken(flowToken, 'login');
    if (!flow) {
      return NextResponse.json({ error: 'انتهت مهلة الدخول — أعد إدخال كلمة المرور' }, { status: 401 });
    }

    const accountLocked = lockoutResponse(meta, flow.sub);
    if (accountLocked) return accountLocked;

    let method = 'security-key';
    if (body.recoveryCode) {
      if (!consumeRecoveryCode(flow.sub, String(body.recoveryCode))) {
        recordLoginFailure(meta, 'رمز استرداد خاطئ', flow.sub);
        return NextResponse.json({ error: 'رمز الاسترداد غير صحيح أو مستعمل' }, { status: 401 });
      }
      method = 'recovery-code';
    } else {
      try {
        await finishAuthentication(req, flowToken, body.response, 'login');
      } catch (err: any) {
        recordLoginFailure(meta, 'فشل التحقق بمفتاح الأمان', flow.sub);
        const expired = err?.message === 'FLOW_EXPIRED';
        return NextResponse.json(
          { error: expired ? 'انتهت مهلة الدخول — أعد إدخال كلمة المرور' : 'تعذّر التحقق من مفتاح الأمان' },
          { status: 401 }
        );
      }
    }

    // Re-read the account: it may have been disabled since the password step.
    const user = getSqliteDb().prepare('SELECT * FROM users WHERE id = ?').get(flow.sub) as any;
    if (!user || user.loginEnabled === 0 || ['SUSPENDED', 'REJECTED', 'PENDING', 'PENDING_APPROVAL'].includes(user.status)) {
      return NextResponse.json({ error: 'تم إيقاف هذا الحساب' }, { status: 403 });
    }
    if (!isPrivilegedRole(normalizeLoginRole(user.role))) {
      return NextResponse.json({ error: 'طريقة دخول غير صالحة لهذا الحساب' }, { status: 400 });
    }

    if (method === 'recovery-code') {
      try {
        dbLogAudit(user.name, user.role, 'دخول برمز استرداد', `المتبقي: ${remainingRecoveryCodes(user.id)}`, meta.clientIp);
      } catch {
        /* optional */
      }
    }

    const res = completeLogin(user, meta, { mfa: true, method });
    if (method === 'recovery-code') {
      const data = await res.clone().json();
      return NextResponse.json(
        { ...data, recoveryCodesLeft: remainingRecoveryCodes(user.id) },
        { status: res.status, headers: res.headers }
      );
    }
    return res;
  } catch (error: any) {
    console.error('[webauthn/login]', error?.message || error);
    return NextResponse.json({ error: 'تعذّر إكمال الدخول' }, { status: 500 });
  }
}

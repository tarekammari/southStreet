import { NextResponse } from 'next/server';
import { dbLogAudit } from '@/lib/db';
import { ADMINS, requireRole, requireStepUp } from '@/lib/staff-gate';
import {
  beginRegistration,
  countCredentials,
  deleteCredential,
  finishRegistration,
  issueRecoveryCodes,
  listCredentials,
  parseKeyKind,
  remainingRecoveryCodes,
} from '@/lib/webauthn';

/** The signed-in Super Admin / Admin manages their own security keys. */

export async function GET(req: Request) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  const keys = listCredentials(gate.account.id).map((k) => ({
    id: k.credential_id,
    label: k.label || 'مفتاح أمان',
    createdAt: k.created_at || null,
    lastUsedAt: k.last_used_at || null,
  }));
  return NextResponse.json({ keys, recoveryCodesLeft: remainingRecoveryCodes(gate.account.id) });
}

export async function POST(req: Request) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === 'options') {
      const stepUp = requireStepUp(req, gate);
      if (stepUp) return stepUp.error;
      const started = await beginRegistration(req, {
        id: gate.account.id,
        username: gate.account.username,
        name: gate.account.name,
      }, {}, parseKeyKind(body.kind));
      return NextResponse.json(started);
    }

    if (body.action === 'verify') {
      const result = await finishRegistration(req, String(body.flowToken || ''), body.response, String(body.label || 'مفتاح أمان'));
      if (result.userId !== gate.account.id) {
        deleteCredential(result.userId, result.credentialId);
        return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
      }
      dbLogAudit(gate.account.name, gate.account.role, 'إضافة مفتاح أمان', String(body.label || ''));
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'recovery') {
      const stepUp = requireStepUp(req, gate);
      if (stepUp) return stepUp.error;
      const recoveryCodes = issueRecoveryCodes(gate.account.id);
      dbLogAudit(gate.account.name, gate.account.role, 'إعادة إصدار رموز الاسترداد', '');
      return NextResponse.json({ recoveryCodes });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error: any) {
    const msg = String(error?.message || '');
    const known: Record<string, string> = {
      FLOW_EXPIRED: 'انتهت المهلة — أعد المحاولة',
      KEY_NOT_VERIFIED: 'تعذّر التحقق من المفتاح',
      KEY_ALREADY_REGISTERED: 'هذا المفتاح مسجّل مسبقاً',
      MAX_KEYS: 'تم بلوغ الحد الأقصى للمفاتيح (10)',
      WEBAUTHN_NOT_CONFIGURED: 'إعدادات مفاتيح الأمان غير مكتملة على الخادم (WEBAUTHN_RP_ID و WEBAUTHN_ORIGINS في ملف .env)',
    };
    if (!known[msg]) console.error('[security-keys]', error);
    return NextResponse.json({ error: known[msg] || 'تعذّر تنفيذ الطلب' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  const stepUp = requireStepUp(req, gate);
  if (stepUp) return stepUp.error;

  const id = new URL(req.url).searchParams.get('id') || '';
  if (countCredentials(gate.account.id) <= 1) {
    return NextResponse.json({ error: 'لا يمكن حذف آخر مفتاح — أضف مفتاحاً آخر أولاً' }, { status: 409 });
  }
  if (!deleteCredential(gate.account.id, id)) {
    return NextResponse.json({ error: 'المفتاح غير موجود' }, { status: 404 });
  }
  dbLogAudit(gate.account.name, gate.account.role, 'حذف مفتاح أمان', id.slice(0, 12));
  return NextResponse.json({ ok: true });
}

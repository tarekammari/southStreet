import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { FINANCE_ROLES } from '@/lib/finance-auth';
import { requireRole, requireStepUp, type GateOk } from '@/lib/staff-gate';
import {
  ApprovalError,
  approvalThreshold,
  approveRequest,
  listOpenRequests,
  listRecentDecisions,
  overrideRequest,
  rejectRequest,
  setApprovalThreshold,
  submitClientPayment,
  submitVoid,
  validateRequest,
  type Staff,
} from '@/lib/finance-approvals';
import {
  clientAccountBalances,
  collectibleReservations,
  listClientPayments,
  listHiddenIncomeClients,
  listPurgedIncomeClientKeys,
  purgeIncomeClient,
  setIncomeClientHidden,
  type ClientPaymentSource,
} from '@/lib/finance';
import { buildClientAvatarIndex } from '@/lib/finance-avatars-server';
import { dbLogAudit } from '@/lib/db';
import { resolveRequestIp } from '@/lib/security-threats';

export const dynamic = 'force-dynamic';

function requireFinanceAccess(req: NextRequest) {
  return requireRole(req, FINANCE_ROLES);
}

function staffOf(gate: GateOk): Staff {
  return { id: String(gate.account.id), name: String(gate.account.name || gate.payload.name || 'موظف'), role: gate.role };
}

function actorOf(gate: { payload: { name?: string; sub?: string }; role: string }) {
  return {
    name: String(gate.payload.name || gate.payload.sub || 'محاسب'),
    role: String(gate.role || 'ACCOUNTANT'),
  };
}

function ipOf(req: NextRequest) {
  return resolveRequestIp({
    forwarded: req.headers.get('x-forwarded-for'),
    realIp: req.headers.get('x-real-ip'),
    fallback: '127.0.0.1',
  });
}

/** Mirror sensitive income ops into the admin security audit trail. */
function logIncomeAdminAudit(
  req: NextRequest,
  gate: { payload: { name?: string; sub?: string }; role: string },
  action: string,
  details: string
) {
  const actor = actorOf(gate);
  try {
    dbLogAudit(actor.name, actor.role, action, details, ipOf(req));
  } catch {
    /* admin audit is best-effort */
  }
}

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const approvals = {
    open: listOpenRequests(),
    recent: listRecentDecisions(),
    threshold: approvalThreshold(),
    me: { id: String(gate.account.id), role: gate.role },
  };
  if (searchParams.get('view') === 'approvals') return NextResponse.json({ approvals });
  return NextResponse.json({
    payments: listClientPayments({
      reservation_id: searchParams.get('reservation_id') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      include_void: searchParams.get('include_void') === '1',
    }),
    reservations: collectibleReservations(),
    credits: clientAccountBalances(),
    avatar_index: buildClientAvatarIndex(),
    hidden_clients: listHiddenIncomeClients(),
    purged_clients: listPurgedIncomeClientKeys(),
    approvals,
  });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const action = String(body.action || '').toLowerCase();

    // Segregation of duties: validation, approvals and the Super Admin override.
    const staff = staffOf(gate);
    const ip = ipOf(req);
    const superStepUp = () => (gate.role === 'SUPER_ADMIN' ? requireStepUp(req, gate) : null);

    if (action === 'void_payment' || action === 'void_receipt') {
      const stepUp = superStepUp();
      if (stepUp) return stepUp.error;
      const id = String(body.id || body.payment_id || body.receipt_id || '').trim();
      const out = submitVoid(action === 'void_payment' ? 'payment' : 'receipt', id, staff, {
        overrideReason: body.override_reason,
        reason: body.reason,
        ip,
      });
      return NextResponse.json(out, { status: out.queued ? 202 : 200 });
    }

    if (action === 'validate_request') {
      return NextResponse.json(validateRequest(String(body.id || ''), staff, ip));
    }
    if (action === 'approve_request' || action === 'override_request') {
      const stepUp = requireStepUp(req, gate);
      if (stepUp) return stepUp.error;
      return NextResponse.json(
        action === 'approve_request'
          ? approveRequest(String(body.id || ''), staff, ip)
          : overrideRequest(String(body.id || ''), staff, body.override_reason, ip)
      );
    }
    if (action === 'reject_request') {
      return NextResponse.json(rejectRequest(String(body.id || ''), staff, body.reason, ip));
    }
    if (action === 'set_threshold') {
      if (gate.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'تعديل الحد من صلاحية المشرف العام' }, { status: 403 });
      const stepUp = requireStepUp(req, gate);
      if (stepUp) return stepUp.error;
      return NextResponse.json({ threshold: setApprovalThreshold(Number(body.threshold), staff, ip) });
    }

    if (action === 'hide_client' || action === 'unhide_client') {
      const key = String(body.client_key || body.key || '').trim();
      if (!key) return NextResponse.json({ error: 'معرّف العميل مطلوب' }, { status: 400 });
      const row = setIncomeClientHidden(
        key,
        action === 'hide_client',
        gate.payload.name || gate.payload.sub,
        { name: body.name, code: body.code }
      );
      const clientLabel = String(body.name || key);
      auditFinanceMutation(
        gate,
        'update',
        'income_client',
        key,
        null,
        {
          ...row,
          summary_ar: action === 'hide_client' ? 'إخفاء عميل من دليل المداخيل' : 'إعادة إظهار عميل في دليل المداخيل',
        }
      );
      logIncomeAdminAudit(
        req,
        gate,
        action === 'hide_client' ? 'إخفاء عميل مداخيل' : 'إظهار عميل مداخيل',
        action === 'hide_client'
          ? `العميل «${clientLabel}» أُخفي من الدليل الظاهر — متاح في المخفية`
          : `العميل «${clientLabel}» أُعيد إلى الدليل الظاهر`
      );
      return NextResponse.json(row);
    }

    if (action === 'purge_client') {
      const key = String(body.client_key || body.key || '').trim();
      if (!key) return NextResponse.json({ error: 'معرّف العميل مطلوب' }, { status: 400 });
      const row = purgeIncomeClient(key, {
        name: body.name,
        code: body.code,
        purged_by: gate.payload.name || gate.payload.sub,
      });
      const clientLabel = String(body.name || key);
      auditFinanceMutation(gate, 'delete', 'income_client', key, null, {
        ...row,
        summary_ar: 'حذف نهائي لعميل المداخيل (سندات ملغاة + خارج الدليل)',
      });
      logIncomeAdminAudit(
        req,
        gate,
        'حذف نهائي لعميل مداخيل',
        `العميل «${clientLabel}» — حذف نهائي؛ السندات الملغاة تبقى للأرشيف ولا يعود للدليل`
      );
      return NextResponse.json(row);
    }

    if (action) return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });

    const stepUp = superStepUp();
    if (stepUp) return stepUp.error;
    const out = submitClientPayment(
      {
        reservation_id: body.reservation_id || null,
        customer_name: body.customer_name || null,
        customer_code: body.customer_code || null,
        package_name: body.package_name || null,
        amount: Number(body.amount),
        source: String(body.source || 'INCOME').toUpperCase() as ClientPaymentSource,
        method: body.method || null,
        account_id: body.account_id || null,
        entry_date: body.entry_date,
        note: body.note || null,
      },
      staff,
      { overrideReason: body.override_reason, ip }
    );
    return NextResponse.json(out, { status: out.queued ? 202 : 201 });
  } catch (err: any) {
    if (err instanceof ApprovalError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message || 'فشل تسجيل الدفعة' }, { status: 400 });
  }
}

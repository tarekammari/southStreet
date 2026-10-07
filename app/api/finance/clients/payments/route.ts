import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import {
  clientAccountBalances,
  collectibleReservations,
  listClientPayments,
  listHiddenIncomeClients,
  listPurgedIncomeClientKeys,
  purgeIncomeClient,
  recordClientPayment,
  setIncomeClientHidden,
  voidClientPayment,
  voidIncomeReceipt,
  type ClientPaymentSource,
} from '@/lib/finance';
import { buildClientAvatarIndex } from '@/lib/finance-avatars-server';
import { dbLogAudit } from '@/lib/db';
import { resolveRequestIp } from '@/lib/security-threats';

export const dynamic = 'force-dynamic';

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
  });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const action = String(body.action || '').toLowerCase();

    if (action === 'void_payment') {
      const id = String(body.id || body.payment_id || '').trim();
      if (!id) return NextResponse.json({ error: 'معرّف الدفعة مطلوب' }, { status: 400 });
      const row = voidClientPayment(id);
      auditFinanceMutation(gate, 'void', 'client_payment', id, null, {
        ...row,
        summary_ar: 'إلغاء دفعة عميل (تبقى في الملغاة)',
      });
      logIncomeAdminAudit(req, gate, 'إلغاء دفعة مداخيل', `دفعة ${id} — أُلغيت وبقيت للأرشيف`);
      return NextResponse.json(row);
    }

    if (action === 'void_receipt') {
      const id = String(body.id || body.receipt_id || '').trim();
      if (!id) return NextResponse.json({ error: 'معرّف السند مطلوب' }, { status: 400 });
      const row = voidIncomeReceipt(id);
      auditFinanceMutation(gate, 'void', 'receipt', id, null, {
        ...row,
        summary_ar: 'إلغاء سند قبض / دفعة من المداخيل',
      });
      logIncomeAdminAudit(req, gate, 'إلغاء سند مداخيل', `سند ${id} — أُلغي وبقي للأرشيف (الملغاة)`);
      return NextResponse.json(row);
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

    const row = recordClientPayment({
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
      created_by: gate.payload.name || gate.payload.sub,
    });
    auditFinanceMutation(gate, 'create', 'client_payment', String((row as { id?: string })?.id || ''), null, row);
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل تسجيل الدفعة' }, { status: 400 });
  }
}

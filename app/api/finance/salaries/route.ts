import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import {
  createSalary,
  createSalaryAdvance,
  listSalaries,
  markSalaryPaid,
  updateSalary,
  voidSalary,
  type PaymentMethod,
  type SalaryKind,
} from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;
  const month = searchParams.get('month') ? Number(searchParams.get('month')) : undefined;
  const items = listSalaries({ year, month });
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    if (!body.staff_name) return NextResponse.json({ error: 'اسم الموظف مطلوب' }, { status: 400 });
    const kind = String(body.kind || 'salary').toLowerCase() as SalaryKind;
    const common = {
      morshid_id: body.morshid_id || null,
      staff_name: String(body.staff_name),
      period_year: Number(body.period_year) || new Date().getFullYear(),
      period_month: Number(body.period_month) || new Date().getMonth() + 1,
      amount: Number(body.amount),
      note: body.note,
    };
    const actor = gate.payload.name || gate.payload.sub;
    let row: unknown;
    if (kind === 'advance') {
      row = createSalaryAdvance({
        ...common,
        pay_now: body.pay_now !== false,
        created_by: actor,
        account_id: body.account_id || null,
      });
    } else {
      row = createSalary({ ...common, kind: 'salary' });
      if (body.pay_now === true) {
        row = markSalaryPaid(String((row as { id: string }).id), actor, body.account_id || null, {
          payment_date: body.payment_date,
          method: body.method ? (String(body.method).toUpperCase() as PaymentMethod) : undefined,
        });
      }
    }
    auditFinanceMutation(gate, 'create', 'salary', String((row as { id?: string })?.id || ''), null, row);
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل إنشاء الراتب' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const id = String(body.id || '').trim();
    const action = String(body.action || 'mark-paid').toLowerCase().replace('_', '-');
    if (!id) return NextResponse.json({ error: 'معرّف الراتب مطلوب' }, { status: 400 });

    const actor = gate.payload.name || gate.payload.sub;

    if (action === 'mark-paid') {
      const row = markSalaryPaid(id, actor, body.account_id || null, {
        payment_date: body.payment_date,
        method: body.method ? (String(body.method).toUpperCase() as PaymentMethod) : undefined,
      });
      auditFinanceMutation(gate, 'update', 'salary', id, null, row);
      return NextResponse.json(row);
    }

    if (action === 'update') {
      const row = updateSalary(id, {
        amount: body.amount != null ? Number(body.amount) : undefined,
        period_year: body.period_year != null ? Number(body.period_year) : undefined,
        period_month: body.period_month != null ? Number(body.period_month) : undefined,
        note: body.note,
        kind: body.kind ? (String(body.kind).toLowerCase() as SalaryKind) : undefined,
        payment_date: body.payment_date,
        method: body.method ? (String(body.method).toUpperCase() as PaymentMethod) : undefined,
      });
      auditFinanceMutation(gate, 'update', 'salary', id, null, row);
      return NextResponse.json(row);
    }

    if (action === 'void' || action === 'delete') {
      const row = voidSalary(id);
      auditFinanceMutation(gate, 'delete', 'salary', id, null, row);
      return NextResponse.json(row);
    }

    return NextResponse.json({ error: 'إجراء غير مدعوم' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل تحديث الراتب' }, { status: 400 });
  }
}

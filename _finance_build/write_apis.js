const fs = require('fs');
const path = require('path');
const root = 'D:/data/south_street';
function w(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('W', rel);
}

w('app/api/finance/ledger/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { createLedgerEntry, listLedger, type LedgerType } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const rows = listLedger({
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    status: searchParams.get('status') || undefined,
  });
  return NextResponse.json({ items: rows, count: rows.length });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const type = String(body.type || '').toUpperCase() as LedgerType;
    const allowed: LedgerType[] = ['EXPENSE', 'PURCHASE', 'SERVICE_SPEND', 'CASH_IN', 'CASH_OUT'];
    if (!allowed.includes(type)) {
      return NextResponse.json({ error: 'نوع القيد غير صالح' }, { status: 400 });
    }
    const row = createLedgerEntry({
      type,
      amount: Number(body.amount),
      description: body.description,
      entry_date: body.entry_date,
      receipt_id: body.receipt_id || null,
      counterparty: body.counterparty || null,
      method: body.method || null,
      created_by: gate.payload.name || gate.payload.sub,
      status: 'POSTED',
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل إنشاء القيد' }, { status: 400 });
  }
}
`);

w('app/api/finance/suppliers/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { createSupplier, listSuppliers } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const items = listSuppliers();
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    if (!body.name_ar) return NextResponse.json({ error: 'اسم المورد مطلوب' }, { status: 400 });
    const row = createSupplier({
      code: body.code,
      name_ar: String(body.name_ar),
      contact: body.contact,
      payment_terms_days: body.payment_terms_days,
      status: body.status,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل إنشاء المورد' }, { status: 400 });
  }
}
`);

w('app/api/finance/suppliers/[id]/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { getSupplier, listSupplierInvoices, listSupplierPayments } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { id } = await ctx.params;
  const supplier = getSupplier(id);
  if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
  return NextResponse.json({
    supplier,
    invoices: listSupplierInvoices(id),
    payments: listSupplierPayments(id),
  });
}
`);

w('app/api/finance/suppliers/[id]/invoices/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { createSupplierInvoice, getSupplier, listSupplierInvoices } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { id } = await ctx.params;
  if (!getSupplier(id)) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
  const items = listSupplierInvoices(id);
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const { id } = await ctx.params;
    if (!getSupplier(id)) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
    const body = await req.json();
    const row = createSupplierInvoice({
      supplier_id: id,
      invoice_no: body.invoice_no,
      invoice_date: body.invoice_date,
      due_date: body.due_date,
      amount: Number(body.amount),
      note: body.note,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل إنشاء الفاتورة' }, { status: 400 });
  }
}
`);

w('app/api/finance/suppliers/[id]/payments/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { createSupplierPayment, getSupplier, listSupplierPayments, type PaymentMethod } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { id } = await ctx.params;
  if (!getSupplier(id)) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
  const items = listSupplierPayments(id);
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const { id } = await ctx.params;
    if (!getSupplier(id)) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
    const body = await req.json();
    const method = String(body.method || 'CASH').toUpperCase() as PaymentMethod;
    const row = createSupplierPayment({
      supplier_id: id,
      invoice_id: body.invoice_id || null,
      amount: Number(body.amount),
      method,
      payment_date: body.payment_date,
      note: body.note,
      created_by: gate.payload.name || gate.payload.sub,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل تسجيل الدفعة' }, { status: 400 });
  }
}
`);

w('app/api/finance/suppliers/aging/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { supplierAging } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const items = supplierAging();
  return NextResponse.json({ items, count: items.length });
}
`);

w('app/api/finance/suppliers/debt-summary/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { supplierDebtSummary } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  return NextResponse.json(supplierDebtSummary());
}
`);

w('app/api/finance/salaries/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { createSalary, listSalaries, markSalaryPaid } from '@/lib/finance';

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
    const row = createSalary({
      morshid_id: body.morshid_id || null,
      staff_name: String(body.staff_name),
      period_year: Number(body.period_year) || new Date().getFullYear(),
      period_month: Number(body.period_month) || (new Date().getMonth() + 1),
      amount: Number(body.amount),
      note: body.note,
    });
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
    const action = String(body.action || 'mark-paid').toLowerCase();
    if (!id) return NextResponse.json({ error: 'معرّف الراتب مطلوب' }, { status: 400 });
    if (action !== 'mark-paid' && action !== 'mark_paid') {
      return NextResponse.json({ error: 'إجراء غير مدعوم' }, { status: 400 });
    }
    const row = markSalaryPaid(id, gate.payload.name || gate.payload.sub);
    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل تحديث الراتب' }, { status: 400 });
  }
}
`);

w('app/api/finance/services/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { createService, listServices, type ServiceFrequency } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const items = listServices();
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const frequency = String(body.frequency || 'MONTHLY').toUpperCase() as ServiceFrequency;
    if (!body.name_ar) return NextResponse.json({ error: 'اسم الخدمة مطلوب' }, { status: 400 });
    const row = createService({
      name_ar: String(body.name_ar),
      frequency,
      amount: Number(body.amount),
      next_due_date: body.next_due_date,
      provider: body.provider,
      status: body.status,
      note: body.note,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل إنشاء الخدمة' }, { status: 400 });
  }
}
`);

w('app/api/finance/services/payments/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { createServicePayment, listServicePayments, type PaymentMethod } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get('service_id') || undefined;
  const items = listServicePayments(serviceId);
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const method = String(body.method || 'CASH').toUpperCase() as PaymentMethod;
    const row = createServicePayment({
      service_id: String(body.service_id || ''),
      amount: Number(body.amount),
      method,
      payment_date: body.payment_date,
      note: body.note,
      created_by: gate.payload.name || gate.payload.sub,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل دفع الخدمة' }, { status: 400 });
  }
}
`);

w('app/api/finance/services/upcoming/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { upcomingServices } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get('days') || 45);
  const items = upcomingServices(days);
  return NextResponse.json({ items, count: items.length });
}
`);

w('app/api/finance/reports/summary/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { reportsSummary } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const summary = reportsSummary(
    searchParams.get('from') || undefined,
    searchParams.get('to') || undefined
  );
  return NextResponse.json(summary);
}
`);

console.log('APIs done');
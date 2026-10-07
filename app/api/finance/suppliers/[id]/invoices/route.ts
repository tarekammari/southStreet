import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import {
  createSupplierInvoice,
  getSupplier,
  listSupplierInvoices,
  updateSupplierInvoice,
  voidSupplierInvoice,
} from '@/lib/finance';

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
      amount: body.amount != null ? Number(body.amount) : undefined,
      amount_ht: body.amount_ht != null ? Number(body.amount_ht) : undefined,
      discount: body.discount != null ? Number(body.discount) : undefined,
      tax_rate: body.tax_rate != null ? Number(body.tax_rate) : undefined,
      tax_amount: body.tax_amount != null ? Number(body.tax_amount) : undefined,
      detail_json: body.detail_json != null ? String(body.detail_json) : undefined,
      note: body.note,
    });
    auditFinanceMutation(gate, 'create', 'supplier_invoice', String((row as { id?: string })?.id || ''), null, row);
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل إنشاء الفاتورة' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const { id } = await ctx.params;
    if (!getSupplier(id)) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
    const body = await req.json();
    const target = listSupplierInvoices(id).find((i: any) => i.id === body.id);
    if (!target) return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 });
    if (body.action === 'void') {
      const after = voidSupplierInvoice(String(body.id));
      auditFinanceMutation(gate, 'void', 'supplier_invoice', String(body.id), target, after);
      return NextResponse.json(after);
    }
    const after = updateSupplierInvoice(String(body.id), {
      invoice_no: body.invoice_no,
      invoice_date: body.invoice_date,
      due_date: body.due_date,
      amount: body.amount != null ? Number(body.amount) : undefined,
      amount_ht: body.amount_ht != null ? Number(body.amount_ht) : undefined,
      discount: body.discount != null ? Number(body.discount) : undefined,
      tax_rate: body.tax_rate != null ? Number(body.tax_rate) : undefined,
      tax_amount: body.tax_amount != null ? Number(body.tax_amount) : undefined,
      detail_json: body.detail_json != null ? String(body.detail_json) : undefined,
      note: body.note,
    });
    auditFinanceMutation(gate, 'update', 'supplier_invoice', String(body.id), target, after);
    return NextResponse.json(after);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل تحديث الفاتورة' }, { status: 400 });
  }
}

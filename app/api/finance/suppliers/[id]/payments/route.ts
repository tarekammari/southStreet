import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import {
  createSupplierPayment,
  getSupplier,
  listSupplierPayments,
  updateSupplierPayment,
  voidSupplierPayment,
  type PaymentMethod,
} from '@/lib/finance';

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
    auditFinanceMutation(gate, 'create', 'supplier_payment', String((row as { id?: string })?.id || ''), null, row);
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل تسجيل الدفعة' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const { id } = await ctx.params;
    if (!getSupplier(id)) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
    const body = await req.json();
    const paymentId = String(body.id || '').trim();
    if (!paymentId) return NextResponse.json({ error: 'معرف الدفعة مطلوب' }, { status: 400 });
    const existing = listSupplierPayments(id).find((p: any) => p.id === paymentId);
    if (!existing) return NextResponse.json({ error: 'الدفعة غير موجودة' }, { status: 404 });
    const method = body.method != null ? (String(body.method).toUpperCase() as PaymentMethod) : undefined;
    const row = updateSupplierPayment(paymentId, {
      amount: body.amount != null ? Number(body.amount) : undefined,
      method,
      payment_date: body.payment_date,
      note: body.note,
      invoice_id: body.invoice_id !== undefined ? body.invoice_id || null : undefined,
    });
    auditFinanceMutation(gate, 'update', 'supplier_payment', paymentId, existing, row);
    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل تحديث الدفعة' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const { id } = await ctx.params;
    if (!getSupplier(id)) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
    const paymentId = new URL(req.url).searchParams.get('id') || '';
    if (!paymentId) return NextResponse.json({ error: 'معرف الدفعة مطلوب' }, { status: 400 });
    const existing = listSupplierPayments(id).find((p: any) => p.id === paymentId);
    if (!existing) return NextResponse.json({ error: 'الدفعة غير موجودة' }, { status: 404 });
    const result = voidSupplierPayment(paymentId);
    auditFinanceMutation(gate, 'delete', 'supplier_payment', paymentId, existing, result);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل حذف الدفعة' }, { status: 400 });
  }
}

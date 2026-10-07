import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { getSupplier, listSupplierInvoices, listSupplierPayments, updateSupplier } from '@/lib/finance';

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

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const { id } = await ctx.params;
    const before = getSupplier(id);
    if (!before) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
    const body = await req.json();
    const row = updateSupplier(id, {
      name_ar: body.name_ar,
      code: body.code,
      contact: body.contact,
      payment_terms_days: body.payment_terms_days,
      status: body.status,
      category: body.category,
      scf_code: body.scf_code,
      image_url: body.image_url,
    });
    auditFinanceMutation(gate, 'update', 'supplier', id, before, row);
    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل تحديث المورد' }, { status: 400 });
  }
}

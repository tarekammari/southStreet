import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { getService, listServicePayments, updateService, type ServiceFrequency } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { id } = await ctx.params;
  const service = getService(id);
  if (!service) return NextResponse.json({ error: 'الخدمة غير موجودة' }, { status: 404 });
  return NextResponse.json({
    service,
    payments: listServicePayments(id),
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const { id } = await ctx.params;
    const before = getService(id);
    if (!before) return NextResponse.json({ error: 'الخدمة غير موجودة' }, { status: 404 });
    const body = await req.json();
    const frequency =
      body.frequency !== undefined
        ? (String(body.frequency).toUpperCase() as ServiceFrequency)
        : undefined;
    const row = updateService(id, {
      name_ar: body.name_ar,
      frequency,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      next_due_date: body.next_due_date,
      provider: body.provider,
      supplier_id: body.supplier_id,
      status: body.status,
      note: body.note,
      scf_code: body.scf_code,
    });
    auditFinanceMutation(gate, 'update', 'service', id, before, row);
    return NextResponse.json(row);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تحديث الخدمة';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

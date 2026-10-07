import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { createService, listServices, type ServiceFrequency } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const supplier_id = new URL(req.url).searchParams.get('supplier_id') || undefined;
  const items = listServices(supplier_id ? { supplier_id } : undefined);
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
      supplier_id: body.supplier_id || null,
      status: body.status,
      note: body.note,
      scf_code: body.scf_code,
    });
    auditFinanceMutation(gate, 'create', 'service', String((row as { id?: string })?.id || ''), null, row);
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل إنشاء الخدمة' }, { status: 400 });
  }
}

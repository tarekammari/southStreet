import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { createSupplier, listSuppliers } from '@/lib/finance';
import { resolveSupplierImageUrlServer } from '@/lib/finance-avatars-server';
import { normalizeSupplierCategory } from '@/lib/finance-categories';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || undefined;
  const raw = listSuppliers(category ? { category } : undefined) as {
    image_url?: string | null;
    name_ar?: string;
    category?: string | null;
  }[];
  const items = raw.map((s) => ({
    ...s,
    image_url: resolveSupplierImageUrlServer(s) || s.image_url || null,
  }));
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
      category: normalizeSupplierCategory(body.category),
      scf_code: body.scf_code,
    });
    auditFinanceMutation(gate, 'create', 'supplier', String((row as { id?: string })?.id || ''), null, row);
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل إنشاء المورد' }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { assetsSummary, createAsset, deleteAsset, getAsset, listAssets, updateAsset } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const items = listAssets({
    category: searchParams.get('category') || undefined,
    status: searchParams.get('status') || undefined,
  });
  return NextResponse.json({
    items,
    count: items.length,
    summary: assetsSummary({
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const row = createAsset({
      name_ar: body.name_ar,
      category: body.category,
      quantity: body.quantity,
      unit_cost: Number(body.unit_cost),
      purchase_date: body.purchase_date,
      supplier: body.supplier,
      useful_life_years: body.useful_life_years,
      status: body.status,
      note: body.note,
      post_to_ledger: Boolean(body.post_to_ledger),
      method: body.method,
      created_by: gate.payload.sub,
    });
    auditFinanceMutation(gate, 'create', 'asset', String(row?.id || ''), null, row);
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل تسجيل الأصل' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });
    const id = String(body.id);
    const before = getAsset(id);
    const row = updateAsset(id, body);
    auditFinanceMutation(gate, 'update', 'asset', id, before, row);
    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل تحديث الأصل' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });
    const before = getAsset(id);
    const result = deleteAsset(id);
    auditFinanceMutation(gate, 'delete', 'asset', id, before, result);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل حذف الأصل' }, { status: 400 });
  }
}

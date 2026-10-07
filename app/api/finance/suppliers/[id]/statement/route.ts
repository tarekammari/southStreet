import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { getSupplier, supplierStatement } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { id } = await ctx.params;
  const supplier = getSupplier(id);
  if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });
  const { lines, totals } = supplierStatement(id);
  return NextResponse.json({ supplier, lines, totals, count: lines.length });
}

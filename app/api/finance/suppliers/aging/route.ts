import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { supplierStatusList } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  // Every supplier, including those settled in full, so the UI can flag them.
  const items = supplierStatusList();
  return NextResponse.json({ items, count: items.length });
}

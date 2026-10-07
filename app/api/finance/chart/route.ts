import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { listScfChartAccounts } from '@/lib/scf-chart-seed';
import { ledgerMappingsForUi, supplierMappingsForUi } from '@/lib/scf-category-map';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const cls = searchParams.get('class');
  const q = searchParams.get('q') || undefined;
  const accounts = listScfChartAccounts({
    class: cls ? Number(cls) : undefined,
    q,
    activeOnly: true,
  });
  return NextResponse.json({
    accounts,
    count: accounts.length,
    supplier_mappings: supplierMappingsForUi(),
    ledger_mappings: ledgerMappingsForUi(),
  });
}

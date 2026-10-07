import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { scfEstimatedReport } from '@/lib/scf-estimated-reports';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  return NextResponse.json(
    scfEstimatedReport(searchParams.get('from') || undefined, searchParams.get('to') || undefined)
  );
}

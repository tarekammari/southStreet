import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { servicesStatementForPeriod } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const data = servicesStatementForPeriod(
    searchParams.get('from') || undefined,
    searchParams.get('to') || undefined
  );
  return NextResponse.json(data);
}

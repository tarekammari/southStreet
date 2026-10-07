import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { dailyJournal } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  return NextResponse.json(
    dailyJournal({
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      category: searchParams.get('category') || undefined,
      q: searchParams.get('q') || undefined,
    })
  );
}

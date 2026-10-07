import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { actorFromFinanceGate } from '@/lib/finance-audit';
import { reopenFiscalPeriod } from '@/lib/finance-periods';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);
    const actor = actorFromFinanceGate(gate);
    const row = reopenFiscalPeriod(year, month, actor);
    return NextResponse.json(row);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إعادة الفتح';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

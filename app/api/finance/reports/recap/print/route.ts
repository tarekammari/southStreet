import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { financeRecap } from '@/lib/finance';
import { buildRecapPrintHtml } from '@/lib/recap-print-document';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from')?.slice(0, 10) || '';
  const to = searchParams.get('to')?.slice(0, 10) || '';
  if (!from || !to) {
    return NextResponse.json({ error: 'period required' }, { status: 400 });
  }

  const recap = financeRecap({ from, to });
  const html = buildRecapPrintHtml({
    from: recap.from,
    to: recap.to,
    income: recap.income,
    spending: recap.spending,
    net: recap.net,
    statement: recap.statement,
    balance_sheet: recap.balance_sheet,
    treasury: recap.treasury,
  });

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Doc-Mode': 'recap',
    },
  });
}

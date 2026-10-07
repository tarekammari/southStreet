import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { treasuryAccountDetailMoves, treasuryOverview } from '@/lib/finance';
import { buildTreasuryPrintHtml } from '@/lib/treasury-print-document';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from')?.slice(0, 10) || '';
  const to = searchParams.get('to')?.slice(0, 10) || '';
  const mode = (searchParams.get('mode') || 'full').trim() as 'full' | 'recap' | 'account';
  const account = searchParams.get('account')?.trim() || '';

  if (!from || !to) {
    return NextResponse.json({ error: 'حدّد فترة from و to' }, { status: 400 });
  }

  const overview = treasuryOverview({
    from,
    to,
    flow: mode === 'full' ? 'all' : undefined,
    account: mode === 'account' ? account : undefined,
  });

  let accountMoves;
  if (mode === 'account' && account) {
    accountMoves = treasuryAccountDetailMoves(account, from, to);
  }

  const html = buildTreasuryPrintHtml({
    mode,
    from,
    to,
    overview,
    accountMoves,
  });

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Doc-Mode': mode,
    },
  });
}

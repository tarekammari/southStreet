import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { scfEstimatedReport } from '@/lib/scf-estimated-reports';
import { buildReportsPrintHtml } from '@/lib/reports-print-document';

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

  const report = scfEstimatedReport(from, to);
  const html = buildReportsPrintHtml({
    from: report.resultat.from,
    to: report.resultat.to,
    disclaimer: report.resultat.disclaimer,
    statement: report.resultat.statement,
    balance_sheet: report.position.balance_sheet,
    balanced: report.position.balanced,
    note_ar: report.position.note_ar,
  });

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Doc-Mode': 'reports',
    },
  });
}

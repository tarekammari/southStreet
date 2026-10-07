import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { dailyJournal } from '@/lib/finance';
import { ledgerCategoryLabel } from '@/lib/finance-categories';
import { buildJournalPrintHtml, type JournalPrint } from '@/lib/journal-print-document';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from')?.slice(0, 10) || '';
  const to = searchParams.get('to')?.slice(0, 10) || '';
  const category = searchParams.get('category')?.trim() || '';
  const q = searchParams.get('q')?.trim() || '';

  const journal = dailyJournal({
    from: from || undefined,
    to: to || undefined,
    category: category && category !== 'all' ? category : undefined,
    q: q || undefined,
  }) as JournalPrint;

  const html = buildJournalPrintHtml({
    from,
    to,
    categoryLabel: category && category !== 'all' ? ledgerCategoryLabel(category) : '',
    query: q,
    journal,
  });

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Doc-Mode': 'journal',
    },
  });
}

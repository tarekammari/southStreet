import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { listLedger } from '@/lib/finance';
import { taxBucketOf } from '@/lib/tax-buckets';
import { buildTaxPrintHtml } from '@/lib/tax-print-document';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;

  const { searchParams } = new URL(req.url);
  const year = new Date().getFullYear();
  const from = searchParams.get('from')?.slice(0, 10) || `${year}-01-01`;
  const to = searchParams.get('to')?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const rows = listLedger({ from, to, status: 'POSTED' }) as {
    entry_date?: string;
    description?: string | null;
    counterparty?: string | null;
    amount?: number;
    category?: string | null;
    scf_code?: string | null;
    status?: string | null;
  }[];

  const lines = rows
    .filter((row) => String(row.status || 'POSTED').toUpperCase() !== 'VOID')
    .map((row) => {
      const bucket = taxBucketOf(row);
      if (!bucket) return null;
      return {
        bucket,
        entry_date: String(row.entry_date || '').slice(0, 10),
        description: row.description || row.counterparty || '',
        amount: Number(row.amount) || 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const html = buildTaxPrintHtml({ from, to, lines });
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Doc-Mode': 'taxes',
    },
  });
}

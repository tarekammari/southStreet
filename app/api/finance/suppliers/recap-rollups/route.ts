import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { supplierRecapRollupsForPeriod } from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const from = req.nextUrl.searchParams.get('from') || undefined;
  const to = req.nextUrl.searchParams.get('to') || undefined;
  const items = supplierRecapRollupsForPeriod(from, to);
  const totals = items.reduce(
    (acc, r) => {
      acc.period_invoices += r.period_invoices;
      acc.period_services += r.period_services;
      acc.period_result_amount += r.period_result_amount;
      return acc;
    },
    { period_invoices: 0, period_services: 0, period_result_amount: 0 }
  );
  return NextResponse.json({ from, to, items, totals, count: items.length });
}

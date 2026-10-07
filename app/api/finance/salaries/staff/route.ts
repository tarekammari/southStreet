import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { payrollByStaff, statementModuleAmounts } from '@/lib/finance';
import { payrollOptsFromIso } from '@/lib/finance-period';

export const dynamic = 'force-dynamic';

const num = (v: string | null) => (v ? Number(v) || undefined : undefined);

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const isoFrom = searchParams.get('from')?.slice(0, 10);
  const isoTo = searchParams.get('to')?.slice(0, 10);
  const range =
    isoFrom && isoTo
      ? payrollOptsFromIso(isoFrom, isoTo)
      : {
          from_year: num(searchParams.get('from_year')),
          from_month: num(searchParams.get('from_month')),
          to_year: num(searchParams.get('to_year')),
          to_month: num(searchParams.get('to_month')),
        };
  const roll = payrollByStaff(range);
  const recap =
    isoFrom && isoTo
      ? statementModuleAmounts(isoFrom, isoTo).amounts.payroll
      : null;
  return NextResponse.json({
    ...roll,
    /** When `from`/`to` match الملخص, equals حساب النتيجة → الرواتب */
    statement_payroll_total: recap,
  });
}

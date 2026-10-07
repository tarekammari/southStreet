import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { payrollByStaff } from '@/lib/finance';
import { payrollOptsFromIso } from '@/lib/finance-period';
import { buildPayrollBookHtml, buildStaffPayrollHtml } from '@/lib/payroll-print-document';

export const dynamic = 'force-dynamic';

const num = (v: string | null) => (v ? Number(v) || undefined : undefined);

function periodLabel(searchParams: URLSearchParams): string {
  const from = searchParams.get('from')?.slice(0, 10) || '';
  const to = searchParams.get('to')?.slice(0, 10) || '';
  if (from && to) return `${from} → ${to}`;
  const fy = num(searchParams.get('from_year'));
  const fm = num(searchParams.get('from_month'));
  const ty = num(searchParams.get('to_year'));
  const tm = num(searchParams.get('to_month'));
  if (!fy && !ty) return 'كل الفترات';
  if (fy === ty && fm && tm) {
    if (fm === 1 && tm === 12) return String(fy);
    if (fm === tm) return `${fy}/${String(fm).padStart(2, '0')}`;
    return `${fy}/${String(fm).padStart(2, '0')} → ${ty}/${String(tm).padStart(2, '0')}`;
  }
  return [fy && fm ? `${fy}/${String(fm).padStart(2, '0')}` : '', ty && tm ? `${ty}/${String(tm).padStart(2, '0')}` : '']
    .filter(Boolean)
    .join(' → ');
}

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
  const period = periodLabel(searchParams);
  const staffKey = searchParams.get('staff')?.trim() || '';

  if (staffKey) {
    const person = roll.staff.find((s) => s.key === staffKey);
    if (!person) return NextResponse.json({ error: 'staff not found' }, { status: 404 });
    const html = buildStaffPayrollHtml({
      period,
      staff_name: person.staff_name,
      total: person.total,
      paid_total: person.paid_total,
      pending_total: person.pending_total,
      lines: person.lines || [],
    });
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Doc-Mode': 'payroll-staff',
      },
    });
  }

  const html = buildPayrollBookHtml({
    period,
    total: roll.total,
    paid_total: roll.paid_total,
    pending_total: roll.pending_total,
    staff: roll.staff.map((s) => ({
      staff_name: s.staff_name,
      total: s.total,
      paid_total: s.paid_total,
      pending_total: s.pending_total,
      months: s.months,
    })),
  });
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Doc-Mode': 'payroll',
    },
  });
}

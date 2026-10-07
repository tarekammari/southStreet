import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { createServicePayment, listServicePayments, servicePaymentsInPeriod, type PaymentMethod } from '@/lib/finance';
import { getSqliteDb } from '@/lib/sqlite';
import { normalizeIsoRange } from '@/lib/finance-period';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get('service_id') || undefined;
  const items = listServicePayments(serviceId);
  const isoFrom = searchParams.get('from');
  const isoTo = searchParams.get('to');
  let period_total: number | undefined;
  if (isoFrom && isoTo) {
    const { from, to } = normalizeIsoRange(isoFrom, isoTo);
    period_total = servicePaymentsInPeriod(getSqliteDb(), from, to);
  }
  return NextResponse.json({ items, count: items.length, period_total });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const method = String(body.method || 'CASH').toUpperCase() as PaymentMethod;
    const row = createServicePayment({
      service_id: String(body.service_id || ''),
      amount: Number(body.amount),
      method,
      payment_date: body.payment_date,
      note: body.note,
      created_by: gate.payload.name || gate.payload.sub,
    });
    auditFinanceMutation(gate, 'create', 'service_payment', String((row as { id?: string })?.id || ''), null, row);
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل دفع الخدمة' }, { status: 400 });
  }
}

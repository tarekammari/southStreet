import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { createLedgerEntry, listLedger, type LedgerType } from '@/lib/finance';
import { ledgerCategoryFromType, normalizeLedgerCategory } from '@/lib/finance-categories';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const rows = listLedger({
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    status: searchParams.get('status') || undefined,
    category: searchParams.get('category') || undefined,
  });
  return NextResponse.json({ items: rows, count: rows.length });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const type = String(body.type || '').toUpperCase() as LedgerType;
    const allowed: LedgerType[] = ['EXPENSE', 'PURCHASE', 'SERVICE_SPEND', 'CASH_IN', 'CASH_OUT'];
    if (!allowed.includes(type)) {
      return NextResponse.json({ error: 'نوع القيد غير صالح' }, { status: 400 });
    }
    const category = body.category
      ? normalizeLedgerCategory(body.category)
      : ledgerCategoryFromType(type);
    const row = createLedgerEntry({
      type,
      amount: Number(body.amount),
      description: body.description,
      entry_date: body.entry_date,
      receipt_id: body.receipt_id || null,
      counterparty: body.counterparty || null,
      method: body.method || null,
      account_id: body.account_id || null,
      category,
      created_by: gate.payload.name || gate.payload.sub,
      status: 'POSTED',
    });
    auditFinanceMutation(gate, 'create', 'ledger', String((row as { id?: string })?.id || ''), null, row);
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل إنشاء القيد' }, { status: 400 });
  }
}

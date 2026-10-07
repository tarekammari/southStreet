import { NextRequest, NextResponse } from 'next/server';
import { auditFinanceMutation } from '@/lib/finance-audit';
import { requireFinanceAccess } from '@/lib/finance-auth';
import {
  createTreasuryAccount,
  deleteTreasuryAccount,
  treasuryOverview,
  updateTreasuryAccount,
} from '@/lib/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  return NextResponse.json(
    treasuryOverview({
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      flow: searchParams.get('flow') || searchParams.get('treasury_flow') || undefined,
      account: searchParams.get('account') || searchParams.get('treasury_account') || undefined,
    })
  );
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    const row = createTreasuryAccount(body);
    auditFinanceMutation(gate, 'create', 'treasury', String(row?.id || ''), null, row);
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل إنشاء الحساب' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });
    const id = String(body.id);
    const row = updateTreasuryAccount(id, body);
    auditFinanceMutation(gate, 'update', 'treasury', id, null, row);
    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل تحديث الحساب' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const gate = requireFinanceAccess(req);
    if ('error' in gate) return gate.error;
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });
    const result = deleteTreasuryAccount(id);
    auditFinanceMutation(gate, 'delete', 'treasury', id, null, result);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'فشل حذف الحساب' }, { status: 400 });
  }
}

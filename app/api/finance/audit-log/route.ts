import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { listFinanceAuditLog } from '@/lib/finance-audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;
  const { searchParams } = new URL(req.url);
  const data = listFinanceAuditLog({
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    entity: searchParams.get('entity') || undefined,
    action: searchParams.get('action') || undefined,
    user: searchParams.get('user') || undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
  });
  return NextResponse.json(data);
}

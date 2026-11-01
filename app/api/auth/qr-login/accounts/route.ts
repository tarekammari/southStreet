import { NextResponse } from 'next/server';
import { requireRole, SUPER_ONLY } from '@/lib/staff-gate';
import { isQrTargetRole, listQrAccounts } from '@/lib/qr-login';

export const dynamic = 'force-dynamic';

/** Accounts of one role the Super Admin's phone can open on a new device (search by name, username, email or phone). */
export async function GET(req: Request) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  const url = new URL(req.url);
  const role = url.searchParams.get('role') || '';
  if (!isQrTargetRole(role)) return NextResponse.json({ error: 'دور غير معروف' }, { status: 400 });
  const q = (url.searchParams.get('q') || '').slice(0, 60);
  return NextResponse.json(listQrAccounts(role, q), { headers: { 'Cache-Control': 'no-store' } });
}

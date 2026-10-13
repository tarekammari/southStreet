import { NextRequest, NextResponse } from 'next/server';
import { requireRole, SUPER_ONLY } from '@/lib/staff-gate';
import { readStats } from '@/lib/sakhr/capacity';

export const dynamic = 'force-dynamic';

/** Super Admin: how Sakhr is coping (answers, speed, cache, which AI model answered). ?hours=24 */
export async function GET(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  const hours = Math.min(24 * 30, Math.max(1, Number(req.nextUrl.searchParams.get('hours')) || 24));
  return NextResponse.json(readStats(hours), { headers: { 'Cache-Control': 'no-store' } });
}

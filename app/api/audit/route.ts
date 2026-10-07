import { NextRequest, NextResponse } from 'next/server';
import { dbGetAuditLogs } from '@/lib/db';
import { requireRole, SUPER_ONLY } from '@/lib/staff-gate';

/** The security audit trail is visible to the Super Admin only. */
export async function GET(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  return NextResponse.json(dbGetAuditLogs());
}

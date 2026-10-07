import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { type LoginRole } from '@/lib/roles';
import { requireRole } from '@/lib/staff-gate';

export const FINANCE_ROLES = new Set<LoginRole>(['ACCOUNTANT', 'SUPER_ADMIN', 'AGENCY_MANAGER']);

export type FinanceAuthOk = {
  payload: NonNullable<ReturnType<typeof verifyToken>>;
  role: LoginRole;
};

/** Finance APIs share the staff gate: DB role, key-verified admin sessions, revocation. */
export function requireFinanceAccess(req: NextRequest): FinanceAuthOk | { error: NextResponse } {
  const gate = requireRole(req, FINANCE_ROLES);
  if ('error' in gate) return gate;
  return { payload: gate.payload, role: gate.role };
}

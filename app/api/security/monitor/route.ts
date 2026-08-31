import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { normalizeLoginRole } from '@/lib/roles';
import {
  clearLiveFeed,
  getAttackReports,
  getFirewallSettings,
  getIpSummaries,
  getLiveFeed,
  getSecuritySummary,
  getSensitiveEvents,
  listIncidents,
  listRules,
} from '@/lib/security-monitor';
import type { Severity } from '@/lib/security-threats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER']);

function requireAdmin(req: NextRequest): { ok: true; name: string } | { ok: false; res: NextResponse } {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload?.sub) {
    return { ok: false, res: NextResponse.json({ error: 'مطلوب تسجيل دخول الإدارة' }, { status: 401 }) };
  }
  const role = normalizeLoginRole(String(payload.role || ''), {
    email: payload.email,
    roleName: payload.roleName,
  });
  if (!ADMIN_ROLES.has(role)) {
    return { ok: false, res: NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 }) };
  }
  return { ok: true, name: payload.name || 'admin' };
}

export async function GET(req: NextRequest) {
  const gate = requireAdmin(req);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const onlyThreats = url.searchParams.get('threats') === '1';
  const all = url.searchParams.get('all') === '1';
  const severity = (url.searchParams.get('severity') || '') as Severity | '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 80, 200);

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    summary: getSecuritySummary(),
    feed: getLiveFeed(limit, {
      onlyThreats,
      important: !all,
      severity: severity || undefined,
    }),
    sensitive: getSensitiveEvents(30),
    reports: getAttackReports(),
    ips: getIpSummaries(16),
    incidents: listIncidents(40),
    rules: listRules(),
    settings: getFirewallSettings(),
  });
}

/** Clears the in-memory live feed without touching persisted incidents. */
export async function DELETE(req: NextRequest) {
  const gate = requireAdmin(req);
  if (!gate.ok) return gate.res;
  clearLiveFeed();
  return NextResponse.json({ ok: true, message: 'تم مسح سجل المراقبة الحي' });
}

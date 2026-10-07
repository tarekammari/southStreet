import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { normalizeLoginRole } from '@/lib/roles';
import { getSqliteDb } from '@/lib/sqlite';
import { isAllowedMapsUrl, parseGoogleMapsLink } from '@/lib/google-maps-link';
import { requireRole, ADMINS, SUPER_ONLY } from '@/lib/staff-gate';

export const dynamic = 'force-dynamic';

const DB_TABLE_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER']);

function requireDbAdmin(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  return 'error' in gate ? gate.error : null;
}

async function resolveFinalUrl(start: string) {
  let current = start;
  for (let hop = 0; hop < 5; hop += 1) {
    if (!isAllowedMapsUrl(current)) return current;
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'SouthStreetMaps/1.0' },
    });
    if (res.status < 300 || res.status >= 400) return current;
    const location = res.headers.get('location');
    if (!location) return current;
    current = new URL(location, current).toString();
  }
  return current;
}

export async function POST(req: NextRequest) {
  const denied = requireDbAdmin(req);
  if (denied) return denied;

  let url = '';
  try {
    const body = await req.json();
    url = String(body?.url || '').trim();
  } catch {
    url = '';
  }
  if (!url || !isAllowedMapsUrl(url)) {
    return NextResponse.json({ error: 'الصق رابط خرائط جوجل فقط.' }, { status: 400 });
  }

  const direct = parseGoogleMapsLink(url);
  if (direct) return NextResponse.json({ point: direct, url });

  try {
    const finalUrl = await resolveFinalUrl(url);
    const point = parseGoogleMapsLink(finalUrl);
    if (!point) return NextResponse.json({ error: 'الرابط لا يحتوي على نقطة مكان.' }, { status: 422 });
    return NextResponse.json({ point, url: finalUrl });
  } catch {
    return NextResponse.json({ error: 'تعذر فتح الرابط.' }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { ADMINS, requireRole, SUPER_ONLY } from '@/lib/staff-gate';
import { dbLogAudit } from '@/lib/db';
import { hotelSettings, saveHotelSettings } from '@/lib/hotels/engine';

export const dynamic = 'force-dynamic';

/** Margin on supplier hotel prices and the EUR → DZD rate (Super Admin edits, Admin reads). */
export async function GET(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  return NextResponse.json(hotelSettings());
}

export async function POST(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  const b = await req.json().catch(() => ({}));
  const before = hotelSettings();
  const after = saveHotelSettings({ margin_percent: b.margin_percent, supplier_rate_eur: b.supplier_rate_eur });
  try {
    dbLogAudit(String(gate.account.name || 'المشرف العام'), gate.role, 'إعدادات أسعار الفنادق', `الهامش ${before.margin_percent}% → ${after.margin_percent}% · سعر اليورو ${before.supplier_rate_eur ?? '—'} → ${after.supplier_rate_eur ?? '—'}`);
  } catch {
    /* optional */
  }
  return NextResponse.json(after);
}

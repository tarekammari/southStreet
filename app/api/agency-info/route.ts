import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';

export const dynamic = 'force-dynamic';

/** Public contact card of the agency (about page, footer). Only safe, public fields. */
const PUBLIC_FIELDS = [
  'agency_name', 'legal_name', 'description', 'address', 'city', 'country',
  'phone', 'whatsapp', 'email', 'website', 'opening_hours', 'emergency_phone', 'supported_languages',
] as const;

export async function GET() {
  try {
    const row = (getSqliteDb().prepare("SELECT * FROM agency_settings WHERE id = 'main'").get() || {}) as Record<string, unknown>;
    const info: Record<string, string> = {};
    for (const key of PUBLIC_FIELDS) {
      const value = String(row[key] ?? '').trim();
      if (value) info[key] = value;
    }
    return NextResponse.json(info, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}

import { NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { readSocialLinks, SOCIAL_KEY } from '@/lib/social';
import type { PageContentRow } from '@/lib/page-content';

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
    // Contact channels (WhatsApp, social profiles) edited in the dashboard.
    const socialRow = getSqliteDb().prepare("SELECT * FROM page_content WHERE key = ?").get(SOCIAL_KEY) as PageContentRow | undefined;
    const social = readSocialLinks(socialRow ? [socialRow] : [], info.whatsapp || '');
    return NextResponse.json({ ...info, social }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}

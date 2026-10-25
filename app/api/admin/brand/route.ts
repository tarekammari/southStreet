import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSqliteDb, seedAgencyKnowledge } from '@/lib/sqlite';
import { requireRole, SUPER_ONLY } from '@/lib/staff-gate';
import { BRAND_FIELDS, type BrandField } from '@/lib/brand';
import { getBrand, invalidateBrand, readBrandFromDb } from '@/lib/brand-server';
import { readSocialLinks, SOCIAL_KEY, type SocialLinks } from '@/lib/social';
import type { PageContentRow } from '@/lib/page-content';

export const dynamic = 'force-dynamic';

/** «هوية الوكالة»: the agency's brand, edited by the Super Admin only. */

const LIMITS: Partial<Record<BrandField, number>> = { description: 600, hero_images: 4000, opening_hours: 200 };
const URL_FIELDS = new Set<BrandField>(['logo_url', 'mark_url', 'favicon_url', 'og_image_url', 'map_url', 'website']);
const SOCIAL_FIELDS = ['facebook', 'instagram', 'tiktok', 'youtube', 'telegram', 'x'] as const;

/** Local paths (/images/…, /api/media/…) or http(s) links; nothing else (no javascript:, data:). */
function safeUrl(value: string): boolean {
  return !value || /^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value);
}

function clean(field: BrandField, raw: unknown): string | { error: string } {
  const value = String(raw ?? '').trim().slice(0, LIMITS[field] || 300);
  if (URL_FIELDS.has(field) && !safeUrl(value)) return { error: `رابط غير صالح: ${field}` };
  if (field === 'hero_images' && value.split(/\r?\n|,/).some((u) => !safeUrl(u.trim()))) return { error: 'روابط صور الواجهة غير صالحة' };
  if (field === 'primary_color' && value && !/^#[0-9a-f]{6}$/i.test(value)) return { error: 'اللون يجب أن يكون بصيغة ‎#RRGGBB' };
  if ((field === 'map_lat' || field === 'map_lng') && value && !Number.isFinite(Number(value))) return { error: 'إحداثيات الخريطة غير صالحة' };
  return value;
}

export async function GET(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  try {
    return NextResponse.json(readBrandFromDb(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const values: Partial<Record<BrandField, string>> = {};
    for (const field of BRAND_FIELDS) {
      if (!(field in body)) continue;
      const value = clean(field, body[field]);
      if (typeof value !== 'string') return NextResponse.json({ error: value.error }, { status: 400 });
      values[field] = value;
    }
    if ('agency_name' in values && !values.agency_name) return NextResponse.json({ error: 'اسم الوكالة مطلوب' }, { status: 400 });
    if ('short_name' in values && !values.short_name) return NextResponse.json({ error: 'الاسم المختصر مطلوب' }, { status: 400 });

    const db = getSqliteDb();
    const fields = Object.keys(values) as BrandField[];
    db.transaction(() => {
      if (fields.length) {
        db.prepare(`UPDATE agency_settings SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = 'main'`)
          .run(...fields.map((f) => values[f]));
      }
      // The older `logo` column (team dashboard) follows the brand logo.
      if (values.logo_url) db.prepare("UPDATE agency_settings SET logo = ? WHERE id = 'main'").run(values.logo_url);
      db.prepare("UPDATE agency_settings SET brand_status = 'CONFIGURED' WHERE id = 'main'").run();

      if (body.social && typeof body.social === 'object') {
        const row = db.prepare('SELECT * FROM page_content WHERE key = ?').get(SOCIAL_KEY) as PageContentRow | undefined;
        const current: SocialLinks = readSocialLinks(row ? [row] : [], '');
        const next = { ...current };
        const incoming = body.social as Record<string, unknown>;
        for (const key of SOCIAL_FIELDS) {
          if (!(key in incoming)) continue;
          const url = String(incoming[key] ?? '').trim().slice(0, 300);
          if (!safeUrl(url)) throw new Error(`رابط غير صالح: ${key}`);
          next[key] = url;
        }
        db.prepare(`
          INSERT INTO page_content (key, section, title_ar, title_fr, title_en, content_ar, content_fr, content_en, image_url, updated_at)
          VALUES (?, 'general', 'قنوات التواصل', '', '', ?, '', '', '', ?)
          ON CONFLICT(key) DO UPDATE SET content_ar = excluded.content_ar, updated_at = excluded.updated_at
        `).run(SOCIAL_KEY, JSON.stringify(next), new Date().toISOString());
      }
    })();

    invalidateBrand();
    // Sakhr's built-in answers (address, phone, payment…) now speak for the new brand.
    seedAgencyKnowledge(db);
    return NextResponse.json({ success: true, brand: getBrand(), message: 'تم حفظ هوية الوكالة' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

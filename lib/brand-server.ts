import { getSqliteDb, seedAgencyKnowledge } from './sqlite';
import { BRAND_FIELDS, brandFrom, DEFAULT_BRAND, parseBranches, parsePhones, type Brand, type BrandField } from './brand';
import { readSocialLinks, SOCIAL_KEY, type SocialLinks } from './social';
import type { PageContentRow } from './page-content';
import type { BrandKnowledge } from './brand-profile';

/**
 * The agency's brand for server code (metadata, print documents, Sakhr,
 * messages). Cached for a few seconds and dropped on save, so a page render
 * does not read the database for every title.
 */
const TTL_MS = 15_000;
const store = globalThis as typeof globalThis & { __brandCache?: { at: number; brand: Brand } };

export function readBrandFromDb(): Brand {
  const db = getSqliteDb();
  const row = (db.prepare("SELECT * FROM agency_settings WHERE id = 'main'").get() || null) as Record<string, unknown> | null;
  const socialRow = db.prepare('SELECT * FROM page_content WHERE key = ?').get(SOCIAL_KEY) as PageContentRow | undefined;
  const social = readSocialLinks(socialRow ? [socialRow] : [], String(row?.whatsapp || ''));
  const brand = brandFrom(row, social);
  brand.configured = !row || row.brand_status !== 'DEFAULT';
  return brand;
}

export function getBrand(): Brand {
  const hit = store.__brandCache;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.brand;
  try {
    const brand = readBrandFromDb();
    store.__brandCache = { at: Date.now(), brand };
    return brand;
  } catch {
    // Build without a database, or a broken one: the site still renders.
    return DEFAULT_BRAND;
  }
}

export function invalidateBrand(): void {
  store.__brandCache = undefined;
}

/* ------------------------------------------------------------------ saving */

const LIMITS: Partial<Record<BrandField, number>> = { description: 600, hero_images: 4000, opening_hours: 200 };
const URL_FIELDS = new Set<BrandField>(['logo_url', 'mark_url', 'favicon_url', 'og_image_url', 'map_url', 'website']);
const COLOR_FIELDS = new Set<BrandField>(['primary_color', 'accent_color']);
const SOCIAL_FIELDS = ['facebook', 'instagram', 'tiktok', 'youtube', 'telegram', 'x'] as const;

/** Local paths (/images/…, /api/…) or http(s) links; nothing else (no javascript:, data:). */
function safeUrl(value: string): boolean {
  return !value || /^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value);
}

function clean(field: BrandField, raw: unknown): string {
  const value = String(raw ?? '').trim().slice(0, LIMITS[field] || 300);
  if (URL_FIELDS.has(field) && !safeUrl(value)) throw new Error(`رابط غير صالح: ${field}`);
  if (field === 'hero_images' && value.split(/\r?\n|,/).some((u) => !safeUrl(u.trim()))) throw new Error('روابط صور الواجهة غير صالحة');
  if (COLOR_FIELDS.has(field) && value && !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('اللون يجب أن يكون بصيغة ‎#RRGGBB');
  if ((field === 'map_lat' || field === 'map_lng') && value && !Number.isFinite(Number(value))) throw new Error('إحداثيات الخريطة غير صالحة');
  return value;
}

/** Sakhr answers that came with an agency profile (services, notes): replaced as a set. */
function saveBrandKnowledge(knowledge: BrandKnowledge[]) {
  const db = getSqliteDb();
  const now = new Date().toISOString();
  const keep = new Set(knowledge.map((k) => k.id));
  const old = db.prepare("SELECT id FROM ai_knowledge WHERE id = 'brand_services' OR id LIKE 'brand_note_%'").all() as { id: string }[];
  const drop = db.prepare('DELETE FROM ai_knowledge WHERE id = ?');
  const put = db.prepare(`
    INSERT OR REPLACE INTO ai_knowledge (id, category, title_ar, keywords, response_ar, is_active, updatedBy, updatedAt, answerMode, matchStrategy)
    VALUES (?, 'requirements', ?, ?, ?, 1, 'brand-profile', ?, 'official_exact', 'keywords_or_title')
  `);
  for (const { id } of old) if (!keep.has(id)) drop.run(id);
  for (const k of knowledge) {
    if (!/^brand_(services|note_\d+)$/.test(k.id)) continue;
    put.run(k.id, k.title.slice(0, 120), JSON.stringify(k.keywords.slice(0, 20)), k.text.slice(0, 2000), now);
  }
}

/**
 * Saves «هوية الوكالة» (the dashboard, or an imported profile). Only the
 * fields present in `input` change. Marks the brand as configured, refreshes
 * the cache and rewrites Sakhr's built-in answers for the new brand.
 */
export function saveBrand(input: Record<string, unknown>): Brand {
  const values: Partial<Record<BrandField, string>> = {};
  for (const field of BRAND_FIELDS) if (field in input) values[field] = clean(field, input[field]);
  if ('agency_name' in values && !values.agency_name) throw new Error('اسم الوكالة مطلوب');
  if ('short_name' in values && !values.short_name) throw new Error('الاسم المختصر مطلوب');
  const lists: Record<string, string> = {};
  if ('branches' in input) lists.branches = JSON.stringify(parseBranches(input.branches));
  if ('phones' in input) lists.phones = JSON.stringify(parsePhones(input.phones));

  const db = getSqliteDb();
  const columns: [string, string][] = [...(Object.entries(values) as [string, string][]), ...Object.entries(lists)];
  db.transaction(() => {
    if (columns.length) {
      db.prepare(`UPDATE agency_settings SET ${columns.map(([c]) => `${c} = ?`).join(', ')} WHERE id = 'main'`)
        .run(...columns.map(([, v]) => v));
    }
    // The older `logo` column (team dashboard) follows the brand logo.
    if (values.logo_url) db.prepare("UPDATE agency_settings SET logo = ? WHERE id = 'main'").run(values.logo_url);
    db.prepare("UPDATE agency_settings SET brand_status = 'CONFIGURED' WHERE id = 'main'").run();

    const incoming = input.social && typeof input.social === 'object' ? (input.social as Record<string, unknown>) : null;
    if (incoming || 'whatsapp' in values) {
      const row = db.prepare('SELECT * FROM page_content WHERE key = ?').get(SOCIAL_KEY) as PageContentRow | undefined;
      const next: SocialLinks = { ...readSocialLinks(row ? [row] : [], '') };
      // The contact channels' WhatsApp follows the brand's WhatsApp number.
      if ('whatsapp' in values) next.whatsapp = values.whatsapp || '';
      for (const key of SOCIAL_FIELDS) {
        if (!incoming || !(key in incoming)) continue;
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
    if (Array.isArray(input.knowledge)) saveBrandKnowledge(input.knowledge as BrandKnowledge[]);
  })();

  invalidateBrand();
  // Sakhr's built-in answers (address, phone, payment…) now speak for the new brand.
  seedAgencyKnowledge(db);
  return getBrand();
}

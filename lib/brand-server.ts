import { getSqliteDb } from './sqlite';
import { brandFrom, DEFAULT_BRAND, type Brand } from './brand';
import { readSocialLinks, SOCIAL_KEY } from './social';
import type { PageContentRow } from './page-content';

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

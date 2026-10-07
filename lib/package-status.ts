/**
 * Programme (packages) status: one canonical set, whatever was typed.
 * The table editor offers PUBLISHED / DRAFT / SOLD_OUT / CANCELLED, but rows
 * written by hand or by Sakhr may say "مفتوح", "OPEN", "متاح"… — all of these
 * mean the programme is open for booking.
 */

export type PackageStatus = 'PUBLISHED' | 'DRAFT' | 'SOLD_OUT' | 'CANCELLED';

const SYNONYMS: Record<PackageStatus, string[]> = {
  PUBLISHED: ['PUBLISHED', 'PUBLISH', 'OPEN', 'CURRENT', 'ACTIVE', 'AVAILABLE', 'منشور', 'مفتوح', 'مفتوحة', 'متاح', 'متاحة', 'نشط', 'مفعل', 'مفعّل'],
  DRAFT: ['DRAFT', 'UPCOMING', 'HIDDEN', 'مسودة', 'مخفي', 'قادم', 'قريبا', 'قريباً'],
  SOLD_OUT: ['SOLD_OUT', 'SOLDOUT', 'FULL', 'CLOSED', 'مكتمل', 'مكتملة', 'ممتلئ', 'مغلق', 'مغلقة'],
  CANCELLED: ['CANCELLED', 'CANCELED', 'ملغي', 'ملغى', 'ملغاة'],
};

const LOOKUP = new Map<string, PackageStatus>();
for (const [status, words] of Object.entries(SYNONYMS) as [PackageStatus, string[]][]) {
  for (const word of words) LOOKUP.set(word.toUpperCase(), status);
}

/** Canonical status, or null when the value is empty or unknown. */
export function normalizePackageStatus(value: unknown): PackageStatus | null {
  const key = String(value ?? '').trim().replace(/[\s-]+/g, '_').toUpperCase();
  if (!key) return null;
  return LOOKUP.get(key) ?? LOOKUP.get(key.replace(/_/g, ' ')) ?? null;
}

export function isOpenPackageStatus(value: unknown): boolean {
  return normalizePackageStatus(value) === 'PUBLISHED';
}

/** "featured" arrives as 1 / "1" / true / "نعم" from the editor or Sakhr. */
export function toFeaturedFlag(value: unknown): 0 | 1 {
  if (value === true || value === 1) return 1;
  const s = String(value ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'نعم' ? 1 : 0;
}

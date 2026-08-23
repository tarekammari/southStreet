/** Helpers for rendering SQLite table cells (images, JSON, URLs) */

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)(\?|$)/i;

export function isImageColumnName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n === 'image' ||
    n === 'image_url' ||
    n === 'avatar' ||
    n === 'logo' ||
    n === 'thumbnail' ||
    n === 'photo' ||
    n === 'picture' ||
    n.endsWith('_image') ||
    n.endsWith('_url')
  );
}

export function isImagesArrayColumn(name: string): boolean {
  return name.toLowerCase() === 'images' || name.toLowerCase() === 'videos';
}

export function resolveMediaUrl(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  if (IMAGE_EXT.test(trimmed)) {
    return `/images/${trimmed}`;
  }
  return trimmed;
}

export function extractImageUrls(value: unknown, columnName: string): string[] {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? resolveMediaUrl(v) : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length <= 3 && !trimmed.startsWith('/') && !trimmed.startsWith('http') && columnName.toLowerCase() === 'avatar') {
      return [];
    }
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => (typeof v === 'string' ? resolveMediaUrl(v) : '')).filter(Boolean);
        }
      } catch {
        /* plain string */
      }
    }
    if (isImageColumnName(columnName) || IMAGE_EXT.test(trimmed) || trimmed.startsWith('/api/staff-image') || trimmed.startsWith('/images/')) {
      const url = resolveMediaUrl(trimmed);
      return url ? [url] : [];
    }
  }

  return [];
}

export function formatCellText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function isLongTextColumn(name: string): boolean {
  return /description|services|policy|conditions|keywords|response|content|specialization|details|included|excluded/i.test(
    name
  );
}

export function isImageUploadColumn(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n === 'image' ||
    n === 'image_url' ||
    n === 'logo' ||
    n === 'images' ||
    n === 'photo' ||
    n === 'picture' ||
    n === 'thumbnail' ||
    n.endsWith('_image')
  );
}

const PHOTO_COLUMN_PREF = ['image', 'image_url', 'photo', 'picture', 'logo', 'thumbnail', 'images'];

export function primaryPhotoColumn(names: string[]): string | null {
  const lower = names.map((n) => n.toLowerCase());
  for (const preferred of PHOTO_COLUMN_PREF) {
    const i = lower.indexOf(preferred);
    if (i !== -1) return names[i];
  }
  const fallback = names.find((n) => isImageUploadColumn(n));
  return fallback ?? null;
}

/** `avatar` is often a 1-letter fallback (س / ف), not a photo file. */
export function isAvatarInitial(name: string, value: string): boolean {
  if (name.toLowerCase() !== 'avatar') return false;
  const v = value.trim();
  return v.length > 0 && v.length <= 3 && !/[./]/.test(v) && !v.startsWith('http');
}

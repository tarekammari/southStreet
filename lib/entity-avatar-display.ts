import { DEFAULT_USER_PHOTO, isImageSource } from '@/lib/user-access-view';

const SUPPLIER_TONE: Record<string, string> = {
  hotels: '#0d9488',
  airlines: '#2563eb',
  transport: '#7c3aed',
  visa: '#c2410c',
  insurance: '#0891b2',
  telecom_it: '#4f46e5',
  catering: '#ca8a04',
  ground: '#64748b',
  investment: '#1d4ed8',
  other: '#475569',
};

export function initialsFromName(name: string, max = 2): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '؟';
  if (parts.length === 1) return parts[0].slice(0, max).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function supplierAvatarTone(category?: string | null): string {
  return SUPPLIER_TONE[String(category || 'other')] || SUPPLIER_TONE.other;
}

export function resolveSupplierImageUrl(row: {
  image_url?: string | null;
  name_ar?: string;
  category?: string | null;
}): string {
  const explicit = String(row.image_url || '').trim();
  if (isImageSource(explicit)) return explicit;
  return '';
}

export function resolveClientAvatarFromIndex(
  index: Record<string, string>,
  code?: string | null,
  name?: string | null
): string {
  const c = String(code || '').trim();
  const n = String(name || '').trim();
  if (c && index[c]) return index[c];
  if (c && index[c.toUpperCase()]) return index[c.toUpperCase()];
  if (n && index[n]) return index[n];
  return DEFAULT_USER_PHOTO;
}

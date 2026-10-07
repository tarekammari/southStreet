/** Client-only localStorage wishlist of package ids. */

const KEY = 'ss_package_wishlist';

export function readWishlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeWishlist(ids: string[]): void {
  if (typeof window === 'undefined') return;
  const unique = Array.from(new Set(ids.map(String).filter(Boolean)));
  localStorage.setItem(KEY, JSON.stringify(unique));
  window.dispatchEvent(new CustomEvent('southstreet:wishlist-updated', { detail: unique }));
}

export function isWishlisted(packageId: string): boolean {
  return readWishlist().includes(String(packageId));
}

export function toggleWishlist(packageId: string): string[] {
  const id = String(packageId || '').trim();
  if (!id) return readWishlist();
  const cur = readWishlist();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  writeWishlist(next);
  return next;
}

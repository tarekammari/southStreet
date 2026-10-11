'use client';

/**
 * Public data of the site (programs, hotels, team, page texts, agency card,
 * reviews) loaded ONCE per page from /api/public/catalog — an edge-cached
 * response — instead of one request per section. Every public section reads
 * from the same promise.
 *
 * Signed-in admins/staff bypass the edge cache (?t=…) so their own edits show
 * immediately. If the catalog cannot be loaded, each section falls back to its
 * old individual endpoint.
 */
import { fetchJsonList } from './fetch-json';
import type { PageContentRow } from './page-content';

export type PublicCatalog = {
  packages: any[];
  hotels: any[];
  staff: any[];
  content: PageContentRow[];
  agency: Record<string, any>;
  reviews: { summary: any; reviews: any[] };
};

export const CATALOG_URL = '/api/public/catalog';

let pending: Promise<PublicCatalog | null> | null = null;

function isTeamViewer(): boolean {
  try {
    const role = String(JSON.parse(localStorage.getItem('south_street_user') || '{}')?.role || '').toUpperCase();
    return Boolean(role) && !['PILGRIM_USER', 'PILGRIM', 'CLIENT', 'USER'].includes(role);
  } catch {
    return false;
  }
}

export function loadCatalog(): Promise<PublicCatalog | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  pending ||= fetch(isTeamViewer() ? `${CATALOG_URL}?t=${Date.now()}` : CATALOG_URL, { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return pending;
}

/** Drop the loaded copy (after an admin edit on the same page). */
export function resetCatalog() {
  pending = null;
}

type ListKey = 'packages' | 'hotels' | 'staff' | 'content';
const FALLBACK: Record<ListKey, string> = {
  packages: '/api/admin/packages',
  hotels: '/api/admin/hotels?site=1',
  staff: '/api/admin/morshids',
  content: '/api/admin/content',
};

/** One list of the catalog, or the old endpoint when the catalog is unavailable. */
export async function publicList<T = any>(key: ListKey): Promise<T[]> {
  const catalog = await loadCatalog();
  const list = catalog?.[key];
  if (Array.isArray(list)) return list as T[];
  return fetchJsonList<T>(FALLBACK[key]);
}

export async function publicAgency(): Promise<Record<string, any>> {
  const catalog = await loadCatalog();
  if (catalog?.agency && Object.keys(catalog.agency).length) return catalog.agency;
  return fetch('/api/agency-info', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}));
}

export async function publicReviews(): Promise<{ summary: any; reviews: any[] }> {
  const catalog = await loadCatalog();
  if (catalog?.reviews) return catalog.reviews;
  return fetch('/api/reviews?targetType=agency&targetId=main&limit=8')
    .then((r) => r.json())
    .catch(() => ({ summary: null, reviews: [] }));
}

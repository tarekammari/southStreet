import type { Package } from '@/types';
import { isPackageExpired, parseTripDate } from '@/lib/booking-catalog';

/** Shared presentation helpers for Umrah/Hajj programs (home rail + /packages catalog). */

export const PROGRAM_FALLBACK_IMAGES = [
  '/images/kaaba_sharifa_home_page.webp',
  '/images/kaaba_sharifa_home_page0.jpg',
  '/images/maka01.webp',
  '/images/maka06.webp',
  '/images/maka05.webp',
];

export const PROGRAM_TYPE_LABEL: Record<string, string> = {
  ECONOMY: 'اقتصادية',
  STANDARD: 'عادية',
  PREMIUM: 'مميزة',
  VIP: 'فاخرة',
  FAMILY: 'عائلية',
  GROUP: 'حملة',
  CUSTOM: 'خاصة',
};

export type ProgramKind = 'umrah' | 'hajj' | 'tourism';

export const PROGRAM_KIND_LABEL: Record<ProgramKind, string> = {
  umrah: 'عمرة',
  hajj: 'حج',
  tourism: 'رحلة سياحية',
};

const UMRAH_WORD = /عمر[ةهت]|umrah|omra|omrah|oumra/i;
// Whole word only: "حجز" (booking) and "حجوزات" must not read as Hajj.
const HAJJ_WORD = /(?:^|[^\u0600-\u06FF])(?:[وفبل]?ال|لل)?حج(?:ة|اج)?(?![\u0600-\u06FF])|hajj/i;
const TOURISM_WORD = /سياح|tour|voyage|excursion|[اإ]سطنبول|تركيا|istanbul|turquie|turkey/i;
const HOLY_PLACE = /مكة|مكه|المدينة|المدينه|جدة|جده|makkah|mecca|madin|jeddah|\bJED\b|\bMED\b/i;

/**
 * Packages carry no trip-kind column, so it is read from what the admin typed. The name
 * wins; a Madinah hotel or a hotel/arrival naming a holy city marks a pilgrimage (the
 * "Makkah hotel" slot alone may hold a tourism hotel); descriptions are only trusted for
 * Umrah/Hajj words first, since Umrah programs mention "حافلات سياحية".
 */
export function programKind(pkg: Partial<Pick<Package, 'name' | 'description' | 'season_name' | 'makkah_hotel_name' | 'madinah_hotel_name' | 'arrival_airport'>>): ProgramKind {
  const name = String(pkg.name || '');
  if (TOURISM_WORD.test(name)) return 'tourism';
  if (HAJJ_WORD.test(name)) return 'hajj';
  if (UMRAH_WORD.test(name)) return 'umrah';

  const travel = [pkg.makkah_hotel_name, pkg.madinah_hotel_name, pkg.arrival_airport].map((v) => String(v || '')).join(' ');
  if (String(pkg.madinah_hotel_name || '').trim() || HOLY_PLACE.test(travel)) return 'umrah';

  const description = String(pkg.description || '');
  if (HAJJ_WORD.test(description)) return 'hajj';
  if (UMRAH_WORD.test(description)) return 'umrah';
  if (TOURISM_WORD.test(description)) return 'tourism';

  return UMRAH_WORD.test(String(pkg.season_name || '')) ? 'umrah' : 'tourism';
}

export function isPilgrimageProgram(pkg: Parameters<typeof programKind>[0]): boolean {
  return programKind(pkg) !== 'tourism';
}

/** image_url may hold one link or several (JSON array, commas or new lines). */
export function programImages(pkg: Pick<Package, 'image_url'>): string[] {
  const raw = String(pkg.image_url || '').trim();
  if (!raw) return [];
  let list: unknown[] = [];
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }
  if (!list.length) list = raw.split(/[\n,]+/);
  return Array.from(new Set(list.map((v) => String(v || '').trim()).filter(Boolean)));
}

function isStockHotelPhoto(src?: string): boolean {
  return /unsplash\.com|photo-1566073771259|photo-1582719478250|photo-1542314831|photo-1571896349842/.test(String(src || ''));
}

export function programImage(pkg: Pick<Package, 'image_url'>, index: number): string {
  if (pkg.image_url && !isStockHotelPhoto(pkg.image_url)) return pkg.image_url;
  return PROGRAM_FALLBACK_IMAGES[index % PROGRAM_FALLBACK_IMAGES.length];
}

export function programMinPrice(pkg: Pick<Package, 'prices'>): number {
  const amounts = (pkg.prices || []).map((p) => Number(p.amount) || 0).filter((n) => n > 0);
  return amounts.length ? Math.min(...amounts) : 0;
}

export function formatProgramDate(value?: string, withYear = true): string {
  if (!value) return '';
  const d = parseTripDate(value);
  if (!d) return value;
  return d.toLocaleDateString('ar-DZ', withYear
    ? { year: 'numeric', month: 'long', day: 'numeric' }
    : { month: 'long', day: 'numeric' });
}

export type ProgramAvailability = 'open' | 'few' | 'full' | 'soon' | 'expired';

/** Mirrors BusinessRulesService.checkAvailability so the UI never offers a seat the API would refuse. */
export function programAvailability(pkg: Pick<Package, 'status' | 'available' | 'capacity' | 'start_date' | 'end_date'>): ProgramAvailability {
  if (isPackageExpired(pkg)) return 'expired';
  const status = String(pkg.status || '').toUpperCase();
  if (status === 'UPCOMING' || status === 'DRAFT' || status === 'CLOSED') return 'soon';
  const left = Number(pkg.available) || 0;
  if (status === 'FULL' || left <= 0) return 'full';
  const cap = Number(pkg.capacity) || 0;
  if (left <= 5 || (cap > 0 && left / cap <= 0.15)) return 'few';
  return 'open';
}

export const AVAILABILITY_LABEL: Record<ProgramAvailability, string> = {
  open: 'متاح للحجز',
  few: 'مقاعد قليلة',
  full: 'مكتمل',
  soon: 'قريباً',
  expired: 'منتهٍ',
};

export function isBookable(a: ProgramAvailability): boolean {
  return a === 'open' || a === 'few';
}

/** 0–100: share of seats already taken. */
export function seatFillPercent(pkg: Pick<Package, 'capacity' | 'available'>): number {
  const cap = Number(pkg.capacity) || 0;
  if (cap <= 0) return 0;
  const taken = Math.max(0, cap - (Number(pkg.available) || 0));
  return Math.min(100, Math.round((taken / cap) * 100));
}

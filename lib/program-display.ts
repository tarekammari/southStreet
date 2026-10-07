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

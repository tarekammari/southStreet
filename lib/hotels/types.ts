/**
 * Hotel booking — shared types (server + browser).
 *
 * Offers come from "suppliers": `own` = the agency's own contracted
 * inventory (rooms, nightly prices, availability entered by staff), `test`
 * = a built-in sandbox that behaves like a wholesaler (staff only, never
 * bookable), later Hotelbeds / RateHawk. Prices shown are always the final
 * DZD price for the whole stay; the server recomputes them at booking time.
 */

export type BoardType = 'RO' | 'BB' | 'HB' | 'FB' | 'AI';

export const BOARD_LABEL: Record<BoardType, string> = {
  RO: 'غرفة فقط',
  BB: 'مع الفطور',
  HB: 'نصف إقامة',
  FB: 'إقامة كاملة',
  AI: 'شامل كلياً',
};

export const BOARD_TYPES = Object.keys(BOARD_LABEL) as BoardType[];

export type SupplierId = 'own' | 'test';

export type GuestRoom = { adults: number; children: number; childAges: number[] };

export type HotelSearch = {
  /** Country id (TR, SA…), a city, or words of a hotel name. */
  dest: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  rooms: GuestRoom[];
};

export type HotelOffer = {
  hotel_id: string;
  supplier: SupplierId;
  name: string;
  stars: number;
  city: string;
  city_label: string;
  country: string;
  country_label: string;
  area?: string;
  photo?: string;
  amenities: string[];
  nights: number;
  /** Cheapest total for the whole stay and all rooms (DZD). */
  total_from: number;
  board_from: BoardType;
  free_cancel: boolean;
  /** Fewest rooms left among the cheapest choices (when low). */
  rooms_left?: number;
  latitude?: number | null;
  longitude?: number | null;
};

export type RoomOffer = {
  /** supplier:hotel:room:board — the server re-prices it at booking. */
  offer_id: string;
  room_id: string;
  room_name: string;
  beds?: string;
  max_adults: number;
  max_children: number;
  size_m2?: number | null;
  photos: string[];
  amenities: string[];
  board: BoardType;
  nights: number;
  /** Price for this room for the whole stay (DZD). */
  total: number;
  per_night: number;
  /** Last day a cancellation is free (YYYY-MM-DD), null = non-refundable. */
  free_cancel_until: string | null;
  left: number;
};

export type HotelDetail = Omit<HotelOffer, 'total_from' | 'board_from' | 'free_cancel' | 'rooms_left'> & {
  description: string;
  address: string;
  images: string[];
  check_in_time?: string;
  check_out_time?: string;
  policies?: string;
  /** One list per requested room (same order as the search), cheapest first. */
  offers: RoomOffer[][];
  bookable: boolean;
};

export type HotelStay = {
  hotel_id: string;
  supplier: SupplierId;
  hotel_name: string;
  city: string;
  country: string;
  check_in: string;
  check_out: string;
  nights: number;
  rooms: {
    room_id: string;
    room_name: string;
    board: BoardType;
    adults: number;
    children: number;
    child_ages: number[];
    total: number;
  }[];
  free_cancel_until: string | null;
  supplier_ref?: string;
  guests?: { name: string; passport?: string }[];
  requests?: string;
};

/* ---- helpers shared by server and browser ---- */

/** Arabic-insensitive matching: hamza forms, taa marbuta, alif maqsura, diacritics, case. */
export function normAr(v?: string | null): string {
  return String(v || '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

export const DAY = 86_400_000;

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDay(v?: string | null): Date | null {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isFinite(d.getTime()) ? d : null;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = parseDay(checkIn);
  const b = parseDay(checkOut);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

/** Each night of the stay (YYYY-MM-DD), check-out day excluded. */
export function stayNights(checkIn: string, checkOut: string): string[] {
  const a = parseDay(checkIn);
  const n = nightsBetween(checkIn, checkOut);
  if (!a || n <= 0) return [];
  return Array.from({ length: n }, (_, i) => isoDay(new Date(a.getTime() + i * DAY)));
}

/** "2-0,2-1:7" ⇄ GuestRoom[] (adults-children:childAges). */
export function encodeRooms(rooms: GuestRoom[]): string {
  return rooms
    .map((r) => `${r.adults}-${r.children}${r.childAges.length ? `:${r.childAges.join('.')}` : ''}`)
    .join(',');
}

export function decodeRooms(raw?: string | null): GuestRoom[] {
  const rooms = String(raw || '2-0')
    .split(',')
    .slice(0, 5)
    .map((part) => {
      const [occ, ages] = part.split(':');
      const [a, c] = occ.split('-').map((n) => Math.max(0, Math.min(8, Number(n) || 0)));
      const childAges = String(ages || '')
        .split('.')
        .filter(Boolean)
        .map((n) => Math.max(0, Math.min(17, Number(n) || 0)))
        .slice(0, c);
      return { adults: Math.max(1, a || 1), children: c || 0, childAges: [...childAges, ...Array(Math.max(0, (c || 0) - childAges.length)).fill(8)] };
    });
  return rooms.length ? rooms : [{ adults: 2, children: 0, childAges: [] }];
}

export function guestsSummary(rooms: GuestRoom[]): string {
  const adults = rooms.reduce((s, r) => s + r.adults, 0);
  const kids = rooms.reduce((s, r) => s + r.children, 0);
  return `${rooms.length} ${rooms.length === 1 ? 'غرفة' : 'غرف'} · ${adults} ${adults === 1 ? 'بالغ' : 'بالغين'}${kids ? ` · ${kids} ${kids === 1 ? 'طفل' : 'أطفال'}` : ''}`;
}

/** «آخر غرفة» / «آخر غرفتين» / «آخر 3 غرف». */
export function roomsLeftText(n: number): string {
  return n === 1 ? 'آخر غرفة' : n === 2 ? 'آخر غرفتين' : `آخر ${n} غرف`;
}

export function formatDzd(n: number): string {
  return `${Math.round(Number(n) || 0).toLocaleString('ar-DZ')} دج`;
}

export function arDate(v?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  const d = parseDay(v);
  return d ? d.toLocaleDateString('ar-DZ', { ...opts, timeZone: 'UTC' }) : '';
}

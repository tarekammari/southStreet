/**
 * Tourist trips («رحلات سياحية») are programs like Umrah ones: same table,
 * prices, seats, booking flow and finance. `trip_type` says which kind a
 * program is, and `tour` (JSON) holds what a tourist trip adds: country,
 * cities, day-by-day itinerary, hotels, highlights and the visa note.
 * Shared by the server and the browser (no database access here).
 */

export type TripKind = 'UMRAH' | 'HAJJ' | 'TOURISM';

export const TRIP_KIND_LABEL: Record<TripKind, string> = {
  UMRAH: 'عمرة',
  HAJJ: 'حج',
  TOURISM: 'رحلة سياحية',
};

export const TRIP_KIND_OPTIONS = (Object.keys(TRIP_KIND_LABEL) as TripKind[]).map((value) => ({
  value,
  label: TRIP_KIND_LABEL[value],
}));

export type Destination = {
  id: string;
  label: string;
  /** Accent colour for chips and covers. */
  color: string;
  /** Latin name, used as a large watermark on the home tiles. */
  latin: string;
  cities: string[];
  /** Words a program name may carry for this destination (finance / search). */
  keywords: string[];
  /** Default visa note; the agency handles visas. */
  visa: string;
};

/** The destinations the agency sells. Staff can still type another country. */
export const DESTINATIONS: Destination[] = [
  {
    id: 'TR',
    label: 'تركيا',
    color: '#b91c1c',
    latin: 'TÜRKİYE',
    cities: ['إسطنبول', 'بورصة', 'طرابزون', 'أنطاليا', 'كابادوكيا', 'إزمير'],
    keywords: ['تركيا', 'اسطنبول', 'إسطنبول', 'turkey', 'istanbul', 'türkiye'],
    visa: 'تأشيرة تركيا — الوكالة تتكفّل بالإجراءات وتؤكّد الشروط عند الحجز.',
  },
  {
    id: 'MY',
    label: 'ماليزيا',
    color: '#1d4ed8',
    latin: 'MALAYSIA',
    cities: ['كوالالمبور', 'لنكاوي', 'بينانغ', 'مرتفعات جنتنج', 'ملاكا'],
    keywords: ['ماليزيا', 'كوالالمبور', 'malaysia', 'kuala lumpur'],
    visa: 'شروط دخول ماليزيا — الوكالة تؤكّدها عند الحجز وتتكفّل بالإجراءات.',
  },
  {
    id: 'EG',
    label: 'مصر',
    color: '#b45309',
    latin: 'EGYPT',
    cities: ['القاهرة', 'الإسكندرية', 'شرم الشيخ', 'الغردقة', 'الأقصر', 'أسوان'],
    keywords: ['مصر', 'القاهرة', 'شرم', 'egypt', 'cairo'],
    visa: 'تأشيرة مصر — الوكالة تتكفّل بالإجراءات.',
  },
  {
    id: 'TN',
    label: 'تونس',
    color: '#be123c',
    latin: 'TUNISIA',
    cities: ['تونس العاصمة', 'الحمامات', 'سوسة', 'جربة', 'المنستير', 'طبرقة'],
    keywords: ['تونس', 'الحمامات', 'سوسة', 'جربة', 'tunisia', 'tunis'],
    visa: 'دخول تونس بجواز السفر الجزائري — بدون تأشيرة.',
  },
  {
    id: 'ES',
    label: 'إسبانيا',
    color: '#c2410c',
    latin: 'ESPAÑA',
    cities: ['برشلونة', 'مدريد', 'غرناطة', 'إشبيلية', 'قرطبة', 'ملقة'],
    keywords: ['اسبانيا', 'إسبانيا', 'الأندلس', 'برشلونة', 'مدريد', 'spain', 'barcelona', 'madrid'],
    visa: 'تأشيرة شنغن — الوكالة تجهّز الملف وتحجز الموعد.',
  },
  {
    id: 'GB',
    label: 'لندن',
    color: '#1e3a8a',
    latin: 'LONDON',
    cities: ['لندن', 'مانشستر', 'إدنبرة', 'أكسفورد'],
    keywords: ['لندن', 'بريطانيا', 'المملكة المتحدة', 'london', 'uk', 'england'],
    visa: 'تأشيرة المملكة المتحدة — الوكالة تجهّز الملف وتحجز الموعد.',
  },
];

export function destinationOf(id?: string | null): Destination | null {
  if (!id) return null;
  return DESTINATIONS.find((d) => d.id === id || d.label === id) || null;
}

export type ItineraryDay = { day: number; title: string; details?: string };
export type TourHotel = { city: string; name: string; stars?: number; nights?: number };

export type TourDetails = {
  /** Destination id (TR, MY…) or a free country name. */
  country: string;
  cities: string[];
  highlights: string[];
  itinerary: ItineraryDay[];
  hotels: TourHotel[];
  visa: string;
};

export const EMPTY_TOUR: TourDetails = { country: '', cities: [], highlights: [], itinerary: [], hotels: [], visa: '' };

const str = (v: unknown, max = 400) => String(v ?? '').trim().slice(0, max);
const list = (v: unknown, max = 30): string[] =>
  (Array.isArray(v) ? v : []).map((x) => str(x, 160)).filter(Boolean).slice(0, max);

/** Reads whatever was stored (JSON text or object) into a clean TourDetails. */
export function parseTour(raw: unknown): TourDetails {
  let v: any = raw;
  if (typeof raw === 'string') {
    try {
      v = raw ? JSON.parse(raw) : {};
    } catch {
      v = {};
    }
  }
  if (!v || typeof v !== 'object') v = {};
  return {
    country: str(v.country, 60),
    cities: list(v.cities, 12),
    highlights: list(v.highlights, 20),
    itinerary: (Array.isArray(v.itinerary) ? v.itinerary : [])
      .map((d: any, i: number) => ({ day: Number(d?.day) || i + 1, title: str(d?.title, 160), details: str(d?.details, 1200) }))
      .filter((d: ItineraryDay) => d.title)
      .slice(0, 40),
    hotels: (Array.isArray(v.hotels) ? v.hotels : [])
      .map((h: any) => ({
        city: str(h?.city, 60),
        name: str(h?.name, 120),
        stars: Math.min(5, Math.max(0, Number(h?.stars) || 0)) || undefined,
        nights: Math.max(0, Number(h?.nights) || 0) || undefined,
      }))
      .filter((h: TourHotel) => h.name)
      .slice(0, 12),
    visa: str(v.visa, 600),
  };
}

/** Programs saved before tourist trips existed have no trip_type: Hajj by name, else Umrah. */
export function tripKindOf(pkg: { trip_type?: string | null; name?: string | null }): TripKind {
  const t = String(pkg.trip_type || '').toUpperCase();
  if (t === 'TOURISM' || t === 'HAJJ' || t === 'UMRAH') return t;
  return /حج|hajj/i.test(String(pkg.name || '')) ? 'HAJJ' : 'UMRAH';
}

export function isTourism(pkg: { trip_type?: string | null; name?: string | null }): boolean {
  return tripKindOf(pkg) === 'TOURISM';
}

/** «تركيا» for a tour, '' otherwise. */
export function tourCountryLabel(tour: Pick<TourDetails, 'country'> | null | undefined): string {
  if (!tour?.country) return '';
  const d = destinationOf(tour.country);
  return d ? d.label : tour.country;
}

/** The destination a free text names (program name, city…), by keywords and city names. */
export function guessDestination(text?: string | null): Destination | null {
  const n = String(text || '').toLowerCase();
  if (!n) return null;
  return (
    DESTINATIONS.find((d) => d.keywords.some((k) => n.includes(k.toLowerCase())) || d.cities.some((c) => n.includes(c.toLowerCase()))) ||
    null
  );
}

/**
 * A program's tour details, with the country filled in when staff left it
 * empty but the name or the cities say it («رحلة سياحية إلى إسطنبول» → تركيا).
 */
export function tourOf(pkg: { tour?: unknown; name?: string | null }): TourDetails {
  const tour = parseTour(pkg.tour);
  if (tour.country) return tour;
  const guess = guessDestination([pkg.name, ...tour.cities].filter(Boolean).join(' '));
  return guess ? { ...tour, country: guess.id, visa: tour.visa || guess.visa } : tour;
}

/* ---- Hotels: country from the city ------------------------------------- */

export type HotelCountry = { id: string; label: string; color: string; cities: string[] };

/** Saudi Arabia (the Haram hotels, stored as MAKKAH / MADINAH) first, then the trip destinations. */
export const HOTEL_COUNTRIES: HotelCountry[] = [
  { id: 'SA', label: 'السعودية', color: '#047857', cities: ['MAKKAH', 'MADINAH', 'مكة المكرمة', 'المدينة المنورة', 'جدة'] },
  ...DESTINATIONS.map((d) => ({ id: d.id, label: d.label, color: d.color, cities: d.cities })),
];

const CITY_CODES: Record<string, string> = { MAKKAH: 'مكة المكرمة', MADINAH: 'المدينة المنورة' };

export function hotelCityLabel(city?: string | null): string {
  const c = String(city || '').trim();
  return CITY_CODES[c] || c;
}

/** Country id of a hotel city ('' when unknown). */
export function hotelCountryOf(city?: string | null): string {
  const c = String(city || '').trim();
  if (!c) return '';
  const hit = HOTEL_COUNTRIES.find((k) => k.cities.some((x) => x === c || x.toLowerCase() === c.toLowerCase()));
  return hit?.id || guessDestination(c)?.id || '';
}

/** A program name that clearly names a destination (used where only the name is known, e.g. receipts). */
export function looksLikeTourName(name?: string | null): boolean {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  if (/سياح|رحلة سياحية|tour/i.test(n)) return true;
  return DESTINATIONS.some((d) => d.keywords.some((k) => n.includes(k.toLowerCase())));
}

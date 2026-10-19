/**
 * Hotel search engine. Every source of rooms is a "supplier" with the same
 * three calls (search, detail, re-price), so a wholesaler such as Hotelbeds
 * or RateHawk plugs in later without touching the screens:
 *   - own:  the agency's contracted hotels (lib/hotels/store.ts) — bookable;
 *   - test: a deterministic sandbox shaped like a wholesaler, for staff to try
 *           the flow — never shown to clients, never bookable.
 */
import { DESTINATIONS, HOTEL_COUNTRIES, hotelCityLabel } from '@/lib/tour';
import { getSqliteDb } from '@/lib/sqlite';
import { ensureHotelSchema, getHotelRow, listHotelRows, ownOffers, type HotelRow } from '@/lib/hotels/store';
import {
  BOARD_LABEL,
  nightsBetween,
  normAr,
  parseDay,
  stayNights,
  type BoardType,
  type GuestRoom,
  type HotelDetail,
  type HotelOffer,
  type HotelSearch,
  type RoomOffer,
  type SupplierId,
} from '@/lib/hotels/types';

export type EngineOpts = { staff: boolean };

export class HotelSearchError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Dates and rooms must make sense before anything is priced. */
export function validateSearch(s: HotelSearch) {
  const a = parseDay(s.checkIn);
  const b = parseDay(s.checkOut);
  if (!a || !b) throw new HotelSearchError('اختر تاريخ الوصول والمغادرة');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (a < today) throw new HotelSearchError('تاريخ الوصول مضى');
  const n = nightsBetween(s.checkIn, s.checkOut);
  if (n < 1) throw new HotelSearchError('تاريخ المغادرة بعد الوصول');
  if (n > 30) throw new HotelSearchError('الحجز حتى 30 ليلة');
  if (!s.rooms.length || s.rooms.length > 5) throw new HotelSearchError('من غرفة إلى 5 غرف');
}

/* ------------------------------------------------------------------ *
 * Margin on supplier prices (own prices are already selling prices)
 * ------------------------------------------------------------------ */

export function hotelSettings(): { margin_percent: number; supplier_rate_eur: number | null } {
  ensureHotelSchema();
  const row = getSqliteDb().prepare("SELECT hotel_margin_percent, supplier_rate_eur FROM agency_settings WHERE id = 'main'").get() as any;
  const m = Number(row?.hotel_margin_percent);
  const r = Number(row?.supplier_rate_eur);
  return { margin_percent: Number.isFinite(m) && m >= 0 ? m : 10, supplier_rate_eur: Number.isFinite(r) && r > 0 ? r : null };
}

export function saveHotelSettings(p: { margin_percent?: number; supplier_rate_eur?: number | null }) {
  ensureHotelSchema();
  const cur = hotelSettings();
  const m = p.margin_percent == null ? cur.margin_percent : Math.max(0, Math.min(100, Number(p.margin_percent) || 0));
  const r = p.supplier_rate_eur === undefined ? cur.supplier_rate_eur : p.supplier_rate_eur == null ? null : Math.max(0, Number(p.supplier_rate_eur) || 0) || null;
  getSqliteDb().prepare("UPDATE agency_settings SET hotel_margin_percent = ?, supplier_rate_eur = ? WHERE id = 'main'").run(m, r);
  return hotelSettings();
}

/* ------------------------------------------------------------------ *
 * Test supplier (sandbox)
 * ------------------------------------------------------------------ */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

type TestHotel = HotelRow & { base_eur: number };

const TEST_NAMES = ['Grand Palace', 'Garden View', 'City Centre Suites', 'Sea Breeze Resort'];
const TEST_ROOMS: { id: string; name: string; beds: string; adults: number; children: number; mult: number }[] = [
  { id: 'dbl', name: 'غرفة مزدوجة', beds: 'سرير كبير أو سريران', adults: 2, children: 1, mult: 1 },
  { id: 'trp', name: 'غرفة ثلاثية', beds: '3 أسرّة', adults: 3, children: 1, mult: 1.35 },
  { id: 'fam', name: 'غرفة عائلية', beds: 'سرير كبير + سريران', adults: 4, children: 2, mult: 1.7 },
];
const TEST_BOARDS: { b: BoardType; mult: number }[] = [
  { b: 'RO', mult: 1 },
  { b: 'BB', mult: 1.12 },
  { b: 'HB', mult: 1.3 },
];

function testHotels(): TestHotel[] {
  const out: TestHotel[] = [];
  for (const c of DESTINATIONS) {
    for (const city of c.cities.slice(0, 2)) {
      TEST_NAMES.slice(0, 2 + (hash(city) % 2)).forEach((n, i) => {
        const h = hash(`${city}-${n}`);
        out.push({
          hotel_id: `test_${c.id}_${hash(city) % 9999}_${i}`,
          name: `${n} ${city} (تجريبي)`,
          city,
          city_label: city,
          country: c.id,
          country_label: c.label,
          area: ['وسط المدينة', 'قرب البحر', 'المنطقة التاريخية', 'قرب المطار'][h % 4],
          stars: 3 + (h % 3),
          category: '',
          address: `${city}، ${c.label}`,
          description: 'فندق من المزوّد التجريبي لاختبار الحجز — لا يُحجز ولا يظهر للعملاء.',
          latitude: null,
          longitude: null,
          services: ['واي فاي مجاني', 'استقبال 24 ساعة', h % 2 ? 'مسبح' : 'مطعم', 'تكييف'],
          images: [],
          check_in_time: '14:00',
          check_out_time: '12:00',
          policies: '',
          website: '',
          bookable: false,
          shown: false,
          source_type: 'test',
          distance: '',
          base_eur: 45 + (h % 90),
        });
      });
    }
  }
  return out;
}

function testOffers(h: TestHotel, s: HotelSearch): RoomOffer[][] {
  const nights = stayNights(s.checkIn, s.checkOut);
  const { margin_percent, supplier_rate_eur } = hotelSettings();
  const rate = supplier_rate_eur || 250; // sandbox only: a placeholder rate when none is set
  const all: RoomOffer[] = [];
  for (const r of TEST_ROOMS) {
    for (const bd of TEST_BOARDS) {
      const totalEur = nights.reduce((sum, n) => sum + h.base_eur * r.mult * bd.mult * (1 + (hash(n + h.hotel_id) % 15) / 100), 0);
      const total = Math.round((totalEur * rate * (1 + margin_percent / 100)) / 100) * 100;
      const free = hash(h.hotel_id + r.id) % 3 !== 0;
      const a = parseDay(s.checkIn)!;
      const until = new Date(a.getTime() - 3 * 86_400_000).toISOString().slice(0, 10);
      all.push({
        offer_id: `test:${h.hotel_id}:${r.id}:${bd.b}`,
        room_id: r.id,
        room_name: r.name,
        beds: r.beds,
        max_adults: r.adults,
        max_children: r.children,
        size_m2: 18 + r.adults * 6,
        photos: [],
        amenities: ['تكييف', 'تلفاز', 'خزنة'],
        board: bd.b,
        nights: nights.length,
        total,
        per_night: Math.round(total / Math.max(1, nights.length)),
        free_cancel_until: free && until >= new Date().toISOString().slice(0, 10) ? until : null,
        left: 1 + (hash(h.hotel_id + r.id + s.checkIn) % 6),
      });
    }
  }
  return s.rooms.map((g) =>
    all.filter((o) => o.max_adults >= g.adults && o.max_adults + o.max_children >= g.adults + g.children).sort((x, y) => x.total - y.total)
  );
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

function matchesDest(h: HotelRow, dest: string): boolean {
  const d = normAr(dest);
  if (!d) return true;
  if (normAr(h.country) === d) return true;
  return [h.city, h.city_label, h.name, h.area, h.country_label].some((v) => normAr(v).includes(d));
}

function toOffer(h: HotelRow, supplier: SupplierId, offers: RoomOffer[][], nights: number): HotelOffer | null {
  if (offers.some((list) => list.length === 0)) return null;
  const cheapest = offers.map((list) => list[0]);
  return {
    hotel_id: h.hotel_id,
    supplier,
    name: h.name,
    stars: h.stars,
    city: h.city,
    city_label: h.city_label,
    country: h.country,
    country_label: h.country_label,
    area: h.area || undefined,
    photo: h.images[0],
    amenities: h.services.slice(0, 6),
    nights,
    total_from: cheapest.reduce((s, o) => s + o.total, 0),
    board_from: cheapest[0].board,
    free_cancel: offers.every((list) => list.some((o) => o.free_cancel_until)),
    rooms_left: Math.min(...cheapest.map((o) => o.left)) <= 3 ? Math.min(...cheapest.map((o) => o.left)) : undefined,
    latitude: h.latitude,
    longitude: h.longitude,
  };
}

export function searchHotels(s: HotelSearch, opts: EngineOpts): HotelOffer[] {
  validateSearch(s);
  const nights = nightsBetween(s.checkIn, s.checkOut);
  const out: HotelOffer[] = [];
  for (const h of listHotelRows().filter((x) => x.bookable && matchesDest(x, s.dest))) {
    const offer = toOffer(h, 'own', ownOffers(h.hotel_id, s.checkIn, s.checkOut, s.rooms), nights);
    if (offer) out.push(offer);
  }
  if (opts.staff) {
    for (const h of testHotels().filter((x) => matchesDest(x, s.dest))) {
      const offer = toOffer(h, 'test', testOffers(h, s), nights);
      if (offer) out.push(offer);
    }
  }
  return out.sort((a, b) => a.total_from - b.total_from);
}

export function hotelDetail(hotelId: string, s: HotelSearch, opts: EngineOpts): HotelDetail {
  validateSearch(s);
  const nights = nightsBetween(s.checkIn, s.checkOut);
  let h: HotelRow | null = null;
  let supplier: SupplierId = 'own';
  let offers: RoomOffer[][];
  if (hotelId.startsWith('test_')) {
    if (!opts.staff) throw new HotelSearchError('الفندق غير موجود', 404);
    const t = testHotels().find((x) => x.hotel_id === hotelId);
    if (!t) throw new HotelSearchError('الفندق غير موجود', 404);
    h = t;
    supplier = 'test';
    offers = testOffers(t, s);
  } else {
    h = getHotelRow(hotelId);
    if (!h || (!h.bookable && !opts.staff)) throw new HotelSearchError('الفندق غير متاح للحجز', 404);
    offers = ownOffers(h.hotel_id, s.checkIn, s.checkOut, s.rooms);
  }
  return {
    hotel_id: h.hotel_id,
    supplier,
    name: h.name,
    stars: h.stars,
    city: h.city,
    city_label: h.city_label,
    country: h.country,
    country_label: h.country_label,
    area: h.area || undefined,
    photo: h.images[0],
    amenities: h.services,
    nights,
    latitude: h.latitude,
    longitude: h.longitude,
    description: h.description,
    address: h.address,
    images: h.images,
    check_in_time: h.check_in_time || undefined,
    check_out_time: h.check_out_time || undefined,
    policies: h.policies || undefined,
    offers,
    bookable: supplier === 'own' && h.bookable,
  };
}

/** Re-price the chosen offers at booking time (never trust a price from the browser). */
export function repriceSelection(hotelId: string, s: HotelSearch, offerIds: string[]): { detail: HotelDetail; chosen: RoomOffer[] } {
  const detail = hotelDetail(hotelId, s, { staff: false });
  if (!detail.bookable) throw new HotelSearchError('هذا الفندق لا يُحجز من الموقع', 409);
  if (offerIds.length !== s.rooms.length) throw new HotelSearchError('اختر غرفة لكل غرفة مطلوبة');
  const chosen = offerIds.map((id, i) => detail.offers[i]?.find((o) => o.offer_id === id) || null);
  if (chosen.some((o) => !o)) throw new HotelSearchError('تغيّر توفر الغرف أو السعر — أعد اختيار الغرفة', 409);
  // Several rooms of one type in the same booking must still fit what is left.
  const need = new Map<string, number>();
  for (const o of chosen as RoomOffer[]) need.set(o.room_id, (need.get(o.room_id) || 0) + 1);
  for (const o of chosen as RoomOffer[]) {
    if ((need.get(o.room_id) || 0) > o.left) throw new HotelSearchError(`لم يتبقَّ ما يكفي من «${o.room_name}» لهذه التواريخ`, 409);
  }
  return { detail, chosen: chosen as RoomOffer[] };
}

/* ------------------------------------------------------------------ *
 * Destination suggestions (search box)
 * ------------------------------------------------------------------ */

export type DestSuggestion = { type: 'country' | 'city' | 'hotel'; value: string; label: string; sub?: string; count?: number };

export function destinationSuggestions(q: string, opts: EngineOpts): DestSuggestion[] {
  const hotels = listHotelRows().filter((h) => h.bookable);
  const query = normAr(q);
  const countries: DestSuggestion[] = HOTEL_COUNTRIES.map((c) => ({
    type: 'country' as const,
    value: c.id,
    label: c.label,
    sub: 'بلد',
    count: hotels.filter((h) => h.country === c.id).length,
  }));
  const cityMap = new Map<string, DestSuggestion>();
  for (const h of hotels) {
    const key = h.city;
    const cur = cityMap.get(key);
    if (cur) cur.count = (cur.count || 0) + 1;
    else cityMap.set(key, { type: 'city', value: hotelCityLabel(h.city), label: hotelCityLabel(h.city), sub: h.country_label, count: 1 });
  }
  for (const d of DESTINATIONS) {
    for (const c of d.cities) if (!cityMap.has(c)) cityMap.set(c, { type: 'city', value: c, label: c, sub: d.label, count: 0 });
  }
  const hotelHits: DestSuggestion[] = query
    ? hotels
        .filter((h) => normAr(h.name).includes(query))
        .slice(0, 5)
        .map((h) => ({ type: 'hotel' as const, value: h.name, label: h.name, sub: `${h.city_label} · ${h.country_label}` }))
    : [];
  const match = (x: DestSuggestion) => !query || normAr(x.label).includes(query) || normAr(x.sub).includes(query);
  const rank = (x: DestSuggestion) => (opts.staff ? 0 : x.count ? 0 : 1);
  return [
    ...countries.filter(match).sort((a, b) => rank(a) - rank(b) || (b.count || 0) - (a.count || 0)).slice(0, query ? 4 : 7),
    ...[...cityMap.values()].filter(match).sort((a, b) => rank(a) - rank(b) || (b.count || 0) - (a.count || 0)).slice(0, query ? 6 : 6),
    ...hotelHits,
  ];
}

export { BOARD_LABEL };

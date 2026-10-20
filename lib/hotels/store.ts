/**
 * Hotel inventory (the agency's own contracts): rooms, nightly rates by
 * season and meal plan, availability per night, and what is already booked.
 * Server only. Column names ending in _id / _key / _type / status stay
 * plaintext (filterable); other text is encrypted at rest by the db wrapper,
 * so date ranges are compared in JS, never in SQL.
 */
import { getSqliteDb } from '@/lib/sqlite';
import { HOTEL_COUNTRIES, hotelCityLabel, hotelCountryOf } from '@/lib/tour';
import { seedShowcaseHotels } from '@/lib/hotels/showcase-seed';
import {
  BOARD_TYPES,
  DAY,
  isoDay,
  parseDay,
  stayNights,
  type BoardType,
  type GuestRoom,
  type HotelStay,
  type RoomOffer,
} from '@/lib/hotels/types';

let ready = false;

export function ensureHotelSchema() {
  if (ready) return;
  const db = getSqliteDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS hotel_rooms (
      room_id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      beds TEXT,
      max_adults INTEGER DEFAULT 2,
      max_children INTEGER DEFAULT 0,
      size_m2 INTEGER,
      photos TEXT,
      amenities TEXT,
      quantity INTEGER DEFAULT 5,
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE'
    );
    CREATE INDEX IF NOT EXISTS idx_hotel_rooms_hotel ON hotel_rooms(hotel_id);

    CREATE TABLE IF NOT EXISTS hotel_rates (
      rate_id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      hotel_id TEXT NOT NULL,
      board_type TEXT NOT NULL DEFAULT 'BB',
      label TEXT,
      start_day TEXT,
      end_day TEXT,
      price_night REAL NOT NULL,
      min_nights INTEGER DEFAULT 1,
      free_cancel_days INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_hotel_rates_hotel ON hotel_rates(hotel_id);

    CREATE TABLE IF NOT EXISTS hotel_room_days (
      room_id TEXT NOT NULL,
      day_key TEXT NOT NULL,
      allotment INTEGER,
      stop_sell INTEGER DEFAULT 0,
      PRIMARY KEY (room_id, day_key)
    );
  `);
  const cols = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
  const add = (t: string, c: string, def: string) => {
    if (!cols(t).includes(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`);
  };
  add('hotels', 'country', 'TEXT');
  add('hotels', 'area', 'TEXT');
  add('hotels', 'stars', 'INTEGER');
  add('hotels', 'check_in_time', 'TEXT');
  add('hotels', 'check_out_time', 'TEXT');
  add('hotels', 'policies', 'TEXT');
  add('hotels', 'website', 'TEXT');
  add('hotels', 'source_type', "TEXT DEFAULT 'own'");
  add('hotels', 'source_id', 'TEXT');
  // Shown in hotel search & bookable (separate from "shown on the hotels page").
  add('hotels', 'bookable', 'INTEGER DEFAULT 0');
  add('reservations', 'booking_kind', "TEXT DEFAULT 'TRIP'");
  // booking_kind is encrypted at rest (not a plaintext column name), so it
  // cannot be filtered in SQL; booking_type (…_type stays plaintext) can.
  add('reservations', 'booking_type', 'TEXT');
  for (const r of db.prepare('SELECT reservation_id, booking_kind, booking_type, hotel_stay FROM reservations').all() as any[]) {
    if (r.booking_type) continue;
    if (r.booking_kind === 'HOTEL' || (r.hotel_stay && String(r.hotel_stay).includes('hotel_id'))) {
      db.prepare("UPDATE reservations SET booking_type = 'HOTEL' WHERE reservation_id = ?").run(r.reservation_id);
    }
  }
  add('reservations', 'hotel_id', 'TEXT');
  add('reservations', 'hotel_stay', 'TEXT');
  add('reservations', 'visa_status', 'TEXT');
  add('reservations', 'visa_note', 'TEXT');
  add('agency_settings', 'hotel_margin_percent', 'REAL DEFAULT 10');
  add('agency_settings', 'supplier_rate_eur', 'REAL');
  ready = true;
  try {
    seedShowcaseHotels(db);
  } catch (err) {
    console.error('[hotels] showcase seed failed', err);
  }
}

const json = <T>(v: unknown, fallback: T): T => {
  if (v == null || v === '') return fallback;
  if (typeof v !== 'string') return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};
const list = (v: unknown): string[] => {
  const out = json<unknown>(v, null);
  if (Array.isArray(out)) return out.map(String).filter(Boolean);
  return String(v || '')
    .split(/[\n,،]/)
    .map((s) => s.trim())
    .filter(Boolean);
};
const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ------------------------------------------------------------------ *
 * Hotels
 * ------------------------------------------------------------------ */

export type HotelRow = {
  hotel_id: string;
  name: string;
  city: string;
  city_label: string;
  country: string;
  country_label: string;
  area: string;
  stars: number;
  category: string;
  address: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  services: string[];
  images: string[];
  check_in_time: string;
  check_out_time: string;
  policies: string;
  website: string;
  bookable: boolean;
  shown: boolean;
  source_type: string;
  distance: string;
};

export function starsOf(row: { stars?: unknown; category?: unknown }): number {
  const s = Number(row.stars);
  if (s >= 1 && s <= 5) return s;
  const m = String(row.category || '').match(/(\d)/);
  if (m) return Number(m[1]);
  return String(row.category || '').toUpperCase() === 'VIP' ? 5 : 0;
}

export function mapHotel(h: any): HotelRow {
  const country = String(h.country || '') || hotelCountryOf(h.city);
  return {
    hotel_id: String(h.hotel_id),
    name: String(h.name || ''),
    city: String(h.city || ''),
    city_label: hotelCityLabel(h.city),
    country,
    country_label: HOTEL_COUNTRIES.find((c) => c.id === country)?.label || country,
    area: String(h.area || ''),
    stars: starsOf(h),
    category: String(h.category || ''),
    address: String(h.address || ''),
    description: String(h.description || ''),
    latitude: h.latitude != null && h.latitude !== '' ? Number(h.latitude) : null,
    longitude: h.longitude != null && h.longitude !== '' ? Number(h.longitude) : null,
    services: list(h.services),
    images: list(h.images),
    check_in_time: String(h.check_in_time || ''),
    check_out_time: String(h.check_out_time || ''),
    policies: String(h.policies || ''),
    website: String(h.website || ''),
    bookable: Number(h.bookable) === 1,
    shown: !['INACTIVE', 'HIDDEN', 'DRAFT'].includes(String(h.status || 'ACTIVE').toUpperCase()),
    source_type: String(h.source_type || 'own'),
    distance: String(h.distance_from_haram || ''),
  };
}

export function listHotelRows(): HotelRow[] {
  ensureHotelSchema();
  return (getSqliteDb().prepare('SELECT * FROM hotels').all() as any[]).map(mapHotel);
}

export function getHotelRow(id: string): HotelRow | null {
  ensureHotelSchema();
  const row = getSqliteDb().prepare('SELECT * FROM hotels WHERE hotel_id = ?').get(id);
  return row ? mapHotel(row) : null;
}

/** Booking settings of a hotel (the rest is edited in the hotels table). */
export function saveHotelBooking(id: string, p: {
  bookable?: boolean;
  country?: string;
  area?: string;
  stars?: number;
  check_in_time?: string;
  check_out_time?: string;
  policies?: string;
}) {
  ensureHotelSchema();
  const cur = getHotelRow(id);
  if (!cur) throw new Error('الفندق غير موجود');
  getSqliteDb()
    .prepare(
      `UPDATE hotels SET bookable = ?, country = ?, area = ?, stars = ?, check_in_time = ?, check_out_time = ?, policies = ? WHERE hotel_id = ?`
    )
    .run(
      p.bookable == null ? (cur.bookable ? 1 : 0) : p.bookable ? 1 : 0,
      p.country ?? cur.country,
      String(p.area ?? cur.area).slice(0, 80),
      Math.max(0, Math.min(5, Number(p.stars ?? cur.stars) || 0)),
      String(p.check_in_time ?? cur.check_in_time).slice(0, 10),
      String(p.check_out_time ?? cur.check_out_time).slice(0, 10),
      String(p.policies ?? cur.policies).slice(0, 2000),
      id
    );
  return getHotelRow(id);
}

/* ------------------------------------------------------------------ *
 * Rooms, rates, availability
 * ------------------------------------------------------------------ */

export type RoomRow = {
  room_id: string;
  hotel_id: string;
  name: string;
  beds: string;
  max_adults: number;
  max_children: number;
  size_m2: number | null;
  photos: string[];
  amenities: string[];
  quantity: number;
  sort_order: number;
  active: boolean;
};

export type RateRow = {
  rate_id: string;
  room_id: string;
  hotel_id: string;
  board: BoardType;
  label: string;
  start_day: string;
  end_day: string;
  price_night: number;
  min_nights: number;
  free_cancel_days: number | null;
};

const mapRoom = (r: any): RoomRow => ({
  room_id: String(r.room_id),
  hotel_id: String(r.hotel_id),
  name: String(r.name || ''),
  beds: String(r.beds || ''),
  max_adults: Math.max(1, Number(r.max_adults) || 2),
  max_children: Math.max(0, Number(r.max_children) || 0),
  size_m2: r.size_m2 ? Number(r.size_m2) : null,
  photos: list(r.photos),
  amenities: list(r.amenities),
  quantity: Math.max(0, Number(r.quantity) || 0),
  sort_order: Number(r.sort_order) || 0,
  active: String(r.status || 'ACTIVE').toUpperCase() === 'ACTIVE',
});

const mapRate = (r: any): RateRow => ({
  rate_id: String(r.rate_id),
  room_id: String(r.room_id),
  hotel_id: String(r.hotel_id),
  board: (BOARD_TYPES.includes(r.board_type) ? r.board_type : 'BB') as BoardType,
  label: String(r.label || ''),
  start_day: String(r.start_day || ''),
  end_day: String(r.end_day || ''),
  price_night: Number(r.price_night) || 0,
  min_nights: Math.max(1, Number(r.min_nights) || 1),
  free_cancel_days: r.free_cancel_days == null || r.free_cancel_days === '' ? null : Math.max(0, Number(r.free_cancel_days) || 0),
});

export function listRooms(hotelId: string): RoomRow[] {
  ensureHotelSchema();
  return (getSqliteDb().prepare('SELECT * FROM hotel_rooms WHERE hotel_id = ?').all(hotelId) as any[])
    .map(mapRoom)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ar'));
}

export function listRates(hotelId: string): RateRow[] {
  ensureHotelSchema();
  return (getSqliteDb().prepare('SELECT * FROM hotel_rates WHERE hotel_id = ?').all(hotelId) as any[]).map(mapRate);
}

export function saveRoom(input: Partial<RoomRow> & { hotel_id: string; name: string }) {
  ensureHotelSchema();
  if (!getHotelRow(input.hotel_id)) throw new Error('الفندق غير موجود');
  const name = String(input.name || '').trim().slice(0, 120);
  if (!name) throw new Error('اسم الغرفة مطلوب');
  const id = input.room_id || newId('room');
  getSqliteDb()
    .prepare(`
      INSERT INTO hotel_rooms (room_id, hotel_id, name, beds, max_adults, max_children, size_m2, photos, amenities, quantity, sort_order, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET name = excluded.name, beds = excluded.beds, max_adults = excluded.max_adults,
        max_children = excluded.max_children, size_m2 = excluded.size_m2, photos = excluded.photos, amenities = excluded.amenities,
        quantity = excluded.quantity, sort_order = excluded.sort_order, status = excluded.status
    `)
    .run(
      id,
      input.hotel_id,
      name,
      String(input.beds || '').slice(0, 80),
      Math.max(1, Math.min(10, Number(input.max_adults) || 2)),
      Math.max(0, Math.min(6, Number(input.max_children) || 0)),
      input.size_m2 ? Math.max(0, Number(input.size_m2) || 0) : null,
      JSON.stringify((input.photos || []).slice(0, 12)),
      JSON.stringify((input.amenities || []).slice(0, 20)),
      Math.max(0, Math.min(500, Number(input.quantity ?? 5) || 0)),
      Number(input.sort_order) || 0,
      input.active === false ? 'INACTIVE' : 'ACTIVE'
    );
  return id;
}

export function deleteRoom(roomId: string) {
  ensureHotelSchema();
  const db = getSqliteDb();
  if (bookedOnRoom(roomId) > 0) throw new Error('على هذه الغرفة حجوزات قادمة — أوقفها بدل حذفها');
  db.transaction(() => {
    db.prepare('DELETE FROM hotel_rates WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM hotel_room_days WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM hotel_rooms WHERE room_id = ?').run(roomId);
  })();
}

export function saveRate(input: Partial<RateRow> & { room_id: string; price_night: number }) {
  ensureHotelSchema();
  const room = getSqliteDb().prepare('SELECT room_id, hotel_id FROM hotel_rooms WHERE room_id = ?').get(input.room_id) as any;
  if (!room) throw new Error('الغرفة غير موجودة');
  const price = Math.round(Number(input.price_night) || 0);
  if (price <= 0) throw new Error('سعر الليلة مطلوب');
  const start = parseDay(input.start_day);
  const end = parseDay(input.end_day);
  if (!start || !end || end < start) throw new Error('حدّد فترة السعر (من — إلى)');
  const board = BOARD_TYPES.includes(input.board as BoardType) ? input.board : 'BB';
  const id = input.rate_id || newId('rate');
  getSqliteDb()
    .prepare(`
      INSERT INTO hotel_rates (rate_id, room_id, hotel_id, board_type, label, start_day, end_day, price_night, min_nights, free_cancel_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(rate_id) DO UPDATE SET board_type = excluded.board_type, label = excluded.label, start_day = excluded.start_day,
        end_day = excluded.end_day, price_night = excluded.price_night, min_nights = excluded.min_nights, free_cancel_days = excluded.free_cancel_days
    `)
    .run(
      id,
      room.room_id,
      room.hotel_id,
      board,
      String(input.label || '').slice(0, 60),
      isoDay(start),
      isoDay(end),
      price,
      Math.max(1, Math.min(30, Number(input.min_nights) || 1)),
      input.free_cancel_days == null ? null : Math.max(0, Math.min(60, Number(input.free_cancel_days) || 0))
    );
  return id;
}

export function deleteRate(rateId: string) {
  ensureHotelSchema();
  getSqliteDb().prepare('DELETE FROM hotel_rates WHERE rate_id = ?').run(rateId);
}

/** Allotment override and/or stop-sell for a date range (null allotment = room default). */
export function setRoomDays(roomId: string, from: string, to: string, p: { allotment?: number | null; stop_sell?: boolean }) {
  ensureHotelSchema();
  const a = parseDay(from);
  const b = parseDay(to);
  if (!a || !b || b < a) throw new Error('حدّد الفترة');
  const days = Math.round((b.getTime() - a.getTime()) / DAY) + 1;
  if (days > 400) throw new Error('الفترة أطول من سنة');
  const db = getSqliteDb();
  const up = db.prepare(`
    INSERT INTO hotel_room_days (room_id, day_key, allotment, stop_sell) VALUES (?, ?, ?, ?)
    ON CONFLICT(room_id, day_key) DO UPDATE SET allotment = excluded.allotment, stop_sell = excluded.stop_sell
  `);
  db.transaction(() => {
    for (let i = 0; i < days; i++) {
      up.run(roomId, isoDay(new Date(a.getTime() + i * DAY)), p.allotment == null ? null : Math.max(0, Number(p.allotment) || 0), p.stop_sell ? 1 : 0);
    }
  })();
}

export function listRoomDays(roomId: string): { day_key: string; allotment: number | null; stop_sell: boolean }[] {
  ensureHotelSchema();
  return (getSqliteDb().prepare('SELECT * FROM hotel_room_days WHERE room_id = ?').all(roomId) as any[])
    .map((d) => ({ day_key: String(d.day_key), allotment: d.allotment == null ? null : Number(d.allotment), stop_sell: Number(d.stop_sell) === 1 }))
    .sort((x, y) => x.day_key.localeCompare(y.day_key));
}

/* ------------------------------------------------------------------ *
 * What is already booked
 * ------------------------------------------------------------------ */

const LIVE = new Set(['REQUESTED', 'PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'READY_FOR_TRAVEL']);

function liveStays(): HotelStay[] {
  ensureHotelSchema();
  return (getSqliteDb()
    .prepare("SELECT reservation_status, hotel_stay FROM reservations WHERE booking_type = 'HOTEL'")
    .all() as any[])
    .filter((r) => LIVE.has(String(r.reservation_status || '').toUpperCase()))
    .map((r) => json<HotelStay | null>(r.hotel_stay, null))
    .filter((s): s is HotelStay => Boolean(s && s.supplier === 'own'));
}

/** room_id → day → rooms taken. */
function bookedMap(): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const s of liveStays()) {
    for (const night of stayNights(s.check_in, s.check_out)) {
      for (const r of s.rooms) {
        const m = out.get(r.room_id) || new Map<string, number>();
        m.set(night, (m.get(night) || 0) + 1);
        out.set(r.room_id, m);
      }
    }
  }
  return out;
}

function bookedOnRoom(roomId: string): number {
  const today = isoDay(new Date());
  return liveStays().filter((s) => s.check_out >= today && s.rooms.some((r) => r.room_id === roomId)).length;
}

/* ------------------------------------------------------------------ *
 * Pricing a stay
 * ------------------------------------------------------------------ */

/** Free-cancellation deadline for a rate, or null when it is not (or no longer) free. */
function freeCancelUntil(checkIn: string, days: number | null): string | null {
  if (days == null) return null;
  const a = parseDay(checkIn);
  if (!a) return null;
  const until = isoDay(new Date(a.getTime() - days * DAY));
  return until >= isoDay(new Date()) ? until : null;
}

/**
 * Offers of one hotel from the agency's own inventory: for each requested
 * room, every room type × meal plan that fits the guests, is priced for every
 * night, is open for sale and still has rooms. Cheapest first.
 */
export function ownOffers(hotelId: string, checkIn: string, checkOut: string, rooms: GuestRoom[]): RoomOffer[][] {
  const nights = stayNights(checkIn, checkOut);
  if (!nights.length) return rooms.map(() => []);
  const types = listRooms(hotelId).filter((r) => r.active);
  const rates = listRates(hotelId);
  const booked = bookedMap();
  const db = getSqliteDb();
  const dayRows = new Map<string, Map<string, { allotment: number | null; stop: boolean }>>();
  for (const t of types) {
    const m = new Map<string, { allotment: number | null; stop: boolean }>();
    for (const d of db.prepare('SELECT day_key, allotment, stop_sell FROM hotel_room_days WHERE room_id = ?').all(t.room_id) as any[]) {
      m.set(String(d.day_key), { allotment: d.allotment == null ? null : Number(d.allotment), stop: Number(d.stop_sell) === 1 });
    }
    dayRows.set(t.room_id, m);
  }

  // Rooms left of a type over the whole stay (min over nights).
  const leftOf = (t: RoomRow) =>
    Math.min(
      ...nights.map((n) => {
        const d = dayRows.get(t.room_id)?.get(n);
        if (d?.stop) return 0;
        const cap = d?.allotment ?? t.quantity;
        return Math.max(0, cap - (booked.get(t.room_id)?.get(n) || 0));
      })
    );

  const typeOffers: RoomOffer[] = [];
  for (const t of types) {
    const left = leftOf(t);
    if (left <= 0) continue;
    for (const board of BOARD_TYPES) {
      const mine = rates.filter((r) => r.room_id === t.room_id && r.board === board);
      if (!mine.length) continue;
      let total = 0;
      let minNights = 1;
      let refundable = true;
      let cancelDays = 0;
      let ok = true;
      for (const n of nights) {
        // The most specific (shortest) period covering the night wins.
        const r = mine
          .filter((x) => x.start_day <= n && n <= x.end_day)
          .sort((x, y) => (parseDay(x.end_day)!.getTime() - parseDay(x.start_day)!.getTime()) - (parseDay(y.end_day)!.getTime() - parseDay(y.start_day)!.getTime()))[0];
        if (!r) {
          ok = false;
          break;
        }
        total += r.price_night;
        minNights = Math.max(minNights, r.min_nights);
        // Strictest cancellation among the nights; one non-refundable night makes it non-refundable.
        if (r.free_cancel_days == null) refundable = false;
        else cancelDays = Math.max(cancelDays, r.free_cancel_days);
      }
      if (!ok || nights.length < minNights) continue;
      typeOffers.push({
        offer_id: `own:${hotelId}:${t.room_id}:${board}`,
        room_id: t.room_id,
        room_name: t.name,
        beds: t.beds,
        max_adults: t.max_adults,
        max_children: t.max_children,
        size_m2: t.size_m2,
        photos: t.photos,
        amenities: t.amenities,
        board,
        nights: nights.length,
        total,
        per_night: Math.round(total / nights.length),
        free_cancel_until: freeCancelUntil(checkIn, refundable ? cancelDays : null),
        left,
      });
    }
  }

  return rooms.map((g) =>
    typeOffers
      .filter((o) => o.max_adults >= g.adults && o.max_adults + o.max_children >= g.adults + g.children && o.max_children >= Math.max(0, g.children - (o.max_adults - g.adults)))
      .sort((a, b) => a.total - b.total)
  );
}

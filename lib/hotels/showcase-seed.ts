/**
 * One-time hotel showcase: every shown hotel without rooms gets bookable rooms
 * and indicative prices, and each destination city gets two sample hotels
 * (source_type 'sample', flagged «نموذجي» in the admin). Only fills gaps —
 * never touches a hotel that already has rooms, or a room that has rates.
 * Prices are DZD per room per night and are meant to be edited by the agency.
 */
import type Database from 'better-sqlite3';
import { DESTINATIONS, hotelCountryOf } from '@/lib/tour';
import { cityPhoto } from '@/lib/destination-photos';
import { isoDay, DAY, type BoardType } from '@/lib/hotels/types';

const SEED_KEY = 'showcase-v1';
const IMG = '/images/hotels';

/** Double room, breakfast included, per night (DZD). */
const BASE: Record<string, { 5: number; 4: number }> = {
  MAKKAH: { 5: 42000, 4: 26000 },
  MADINAH: { 5: 34000, 4: 22000 },
  TR: { 5: 26000, 4: 15000 },
  MY: { 5: 19000, 4: 11000 },
  EG: { 5: 17000, 4: 10000 },
  TN: { 5: 16000, 4: 9500 },
  ES: { 5: 34000, 4: 21000 },
  GB: { 5: 48000, 4: 29000 },
  DZ: { 5: 22000, 4: 13000 },
};

const RESORT = new Set(['أنطاليا', 'إزمير', 'لنكاوي', 'بينانغ', 'شرم الشيخ', 'الغردقة', 'الحمامات', 'سوسة', 'جربة', 'المنستير', 'طبرقة', 'ملقة', 'بجاية', 'وهران']);
const SAHARA = new Set(['الوادي', 'غرداية', 'جانت']);
const ORIENTAL = new Set(['TN', 'DZ', 'EG']);

/** Main photo of a sample hotel by country, class and setting. */
function exterior(country: string, stars: 4 | 5, city: string): string {
  const c = country.toLowerCase();
  if (country === 'DZ') return `${IMG}/hotel-dz-${SAHARA.has(city) ? 4 : 5}.jpg`;
  if (country === 'EG') return `${IMG}/hotel-eg-${RESORT.has(city) ? 4 : 5}.jpg`;
  if (country === 'MY') return `${IMG}/hotel-my-${RESORT.has(city) ? 4 : 5}.jpg`;
  if (country === 'TN') return `${IMG}/hotel-tn-${RESORT.has(city) ? 5 : 4}.jpg`;
  return `${IMG}/hotel-${c}-${stars}.jpg`;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
};

type RoomSpec = {
  key: string;
  name: string;
  beds: string;
  adults: number;
  children: number;
  size: number;
  photos: string[];
  amenities: string[];
  mult: number;
  qty: number;
};

const BASIC_AMEN = ['تكييف', 'واي فاي مجاني', 'تلفاز بشاشة مسطحة', 'خزنة', 'ميني بار', 'مجفف شعر'];

function roomSet(stars: 4 | 5, opts: { makkah?: boolean; view?: string }): RoomSpec[] {
  const bath = `${IMG}/facility-bathroom.jpg`;
  const rooms: RoomSpec[] = [
    { key: 'dbl', name: 'غرفة كلاسيك مزدوجة', beds: 'سرير كبير', adults: 2, children: 1, size: stars === 5 ? 30 : 25, photos: [`${IMG}/room-standard.jpg`, bath], amenities: BASIC_AMEN, mult: 1, qty: 12 },
    { key: 'twn', name: 'غرفة توأم', beds: 'سريران منفصلان', adults: 2, children: 1, size: stars === 5 ? 30 : 25, photos: [`${IMG}/room-twin.jpg`, bath], amenities: BASIC_AMEN, mult: 1, qty: 8 },
    opts.makkah
      ? { key: 'vw', name: 'غرفة بإطلالة على الحرم', beds: 'سرير كبير أو سريران', adults: 2, children: 1, size: 34, photos: [`${IMG}/room-makkah.jpg`, bath], amenities: [...BASIC_AMEN, 'إطلالة على الحرم'], mult: 1.45, qty: 6 }
      : { key: 'dlx', name: `غرفة ديلوكس ${opts.view || 'بإطلالة'}`, beds: 'سرير كبير', adults: 2, children: 1, size: stars === 5 ? 38 : 32, photos: [`${IMG}/room-deluxe.jpg`, bath], amenities: [...BASIC_AMEN, 'شرفة', 'ماكينة قهوة'], mult: 1.35, qty: 6 },
    { key: 'fam', name: 'غرفة عائلية', beds: 'سرير كبير + سريران', adults: 4, children: 2, size: stars === 5 ? 48 : 40, photos: [`${IMG}/room-family.jpg`, bath], amenities: [...BASIC_AMEN, 'مساحة جلوس'], mult: 1.75, qty: 4 },
  ];
  if (stars === 5) {
    rooms.push({ key: 'ste', name: 'جناح تنفيذي', beds: 'سرير كبير + صالون منفصل', adults: 2, children: 2, size: 72, photos: [`${IMG}/room-suite.jpg`, `${IMG}/room-deluxe.jpg`, bath], amenities: [...BASIC_AMEN, 'صالون منفصل', 'حوض استحمام', 'خدمة كونسيرج'], mult: 2.6, qty: 2 });
  }
  return rooms;
}

/** Meal plans sold for every room: [board, price factor, free-cancel days or null]. */
function boardsFor(country: string): [BoardType, number, number | null][] {
  if (country === 'MAKKAH' || country === 'MADINAH') return [['RO', 0.88, 3], ['BB', 1, 3]];
  return [['BB', 1, 3], ['HB', 1.28, 7]];
}

const round100 = (n: number) => Math.round(n / 100) * 100;

function addRooms(db: Database.Database, hotelId: string, priceKey: string, stars: 4 | 5, opts: { makkah?: boolean; view?: string }) {
  const base = BASE[priceKey]?.[stars];
  if (!base) return;
  const from = isoDay(new Date());
  const to = isoDay(new Date(Date.now() + 730 * DAY));
  const insRoom = db.prepare(`
    INSERT OR IGNORE INTO hotel_rooms (room_id, hotel_id, name, beds, max_adults, max_children, size_m2, photos, amenities, quantity, sort_order, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `);
  const insRate = db.prepare(`
    INSERT OR IGNORE INTO hotel_rates (rate_id, room_id, hotel_id, board_type, label, start_day, end_day, price_night, min_nights, free_cancel_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);
  roomSet(stars, opts).forEach((r, i) => {
    const roomId = `${hotelId}_${r.key}`;
    insRoom.run(roomId, hotelId, r.name, r.beds, r.adults, r.children, r.size, JSON.stringify(r.photos), JSON.stringify(r.amenities), r.qty, i);
    for (const [board, factor, cancel] of boardsFor(priceKey)) {
      insRate.run(`${roomId}_${board}`, roomId, hotelId, board, 'سعر الموسم', from, to, round100(base * r.mult * factor), cancel);
    }
  });
}

const SERVICES_5 = ['واي فاي مجاني', 'مطعم', 'إفطار بوفيه', 'مسبح', 'سبا وحمّام', 'نادي رياضي', 'خدمة الغرف 24 ساعة', 'استقبال 24 ساعة', 'موقف سيارات', 'نقل من المطار'];
const SERVICES_4 = (resort: boolean) => ['واي فاي مجاني', 'مطعم', 'إفطار بوفيه', resort ? 'مسبح' : 'مقهى', 'استقبال 24 ساعة', 'تكييف', 'موقف سيارات'];
const POLICIES = 'الدخول من الساعة 14:00 والمغادرة قبل 12:00. الأطفال دون 6 سنوات مجاناً في سرير الوالدين. يُطلب جواز السفر أو بطاقة الهوية عند الوصول. الأسعار بالدينار الجزائري للغرفة في الليلة.';

function sampleHotels(): {
  id: string; name: string; city: string; country: string; stars: 4 | 5; area: string;
  images: string[]; services: string[]; description: string; view: string;
}[] {
  const out = [];
  for (const d of DESTINATIONS) {
    for (const city of d.cities) {
      const resort = RESORT.has(city);
      const sahara = SAHARA.has(city);
      const view = resort ? 'بإطلالة على البحر' : sahara ? 'بإطلالة على الواحة' : 'بإطلالة على المدينة';
      const slug = hash(city) % 99991;
      const photo = cityPhoto(city);
      const restaurant = (k: string) => `${IMG}/restaurant-${['fine', 'buffet', 'terrace'][hash(k) % 3]}.jpg`;
      const five = exterior(d.id, 5, city);
      const four = exterior(d.id, 4, city);
      const lobby = `${IMG}/lobby-${ORIENTAL.has(d.id) || sahara ? 'oriental' : 'modern'}.jpg`;
      const pool = `${IMG}/facility-${resort || sahara ? 'pool' : 'pool-indoor'}.jpg`;
      out.push({
        id: `smp_${d.id}_${slug}_5`,
        name: resort ? `منتجع ${city} رويال` : sahara ? `فندق قصر ${city}` : `فندق ${city} جراند بالاس`,
        city,
        country: d.id,
        stars: 5 as const,
        area: resort ? 'على البحر' : sahara ? 'قرب الواحة' : 'وسط المدينة',
        images: [five, lobby, `${IMG}/room-deluxe.jpg`, restaurant(`${city}5`), `${IMG}/facility-breakfast.jpg`, pool, `${IMG}/facility-spa.jpg`, `${IMG}/room-suite.jpg`, ...(photo ? [photo] : [])],
        services: SERVICES_5,
        view,
        description: `فندق خمس نجوم ${resort ? 'على البحر' : sahara ? 'بين النخيل قرب الواحة' : 'في قلب المدينة'} في ${city}، يجمع الفخامة والراحة: غرف وأجنحة واسعة، مطعم يقدّم المطبخ المحلي والعالمي، إفطار بوفيه يومي، مسبح وسبا ونادٍ رياضي، واستقبال على مدار الساعة. خيار مثالي للعائلات والأزواج.`,
      });
      const sameFront = five === four;
      out.push({
        id: `smp_${d.id}_${slug}_4`,
        name: resort ? `فندق ${city} بيتش` : sahara ? `دار ${city} للضيافة` : `فندق ${city} سنترال`,
        city,
        country: d.id,
        stars: 4 as const,
        area: resort ? 'قرب الشاطئ' : sahara ? 'وسط المدينة' : 'قرب المعالم التاريخية',
        images: [sameFront ? (resort ? `${IMG}/facility-pool.jpg` : lobby) : four, `${IMG}/room-standard.jpg`, restaurant(`${city}4`), `${IMG}/facility-breakfast.jpg`, sameFront ? four : lobby, `${IMG}/room-family.jpg`, ...(photo ? [photo] : [])],
        services: SERVICES_4(resort || sahara),
        view,
        description: `فندق أربع نجوم مريح ${resort ? 'على بعد خطوات من الشاطئ' : 'في موقع ممتاز'} في ${city}، بغرف أنيقة ومطعم وإفطار بوفيه يومي${resort || sahara ? ' ومسبح' : ''}، وفريق استقبال يساعدك في التنقل وزيارة المعالم. قيمة ممتازة مقابل السعر.`,
      });
    }
  }
  return out;
}

export function seedShowcaseHotels(db: Database.Database) {
  db.exec('CREATE TABLE IF NOT EXISTS hotel_seeds (seed_key TEXT PRIMARY KEY, applied_at TEXT)');
  if (db.prepare('SELECT seed_key FROM hotel_seeds WHERE seed_key = ?').get(SEED_KEY)) return;

  const hasRooms = (id: string) => Boolean(db.prepare('SELECT room_id FROM hotel_rooms WHERE hotel_id = ? LIMIT 1').get(id));

  db.transaction(() => {
    // 1. The agency's own shown hotels that cannot be booked yet: rooms + prices + booking on.
    for (const h of db.prepare('SELECT * FROM hotels').all() as any[]) {
      if (['INACTIVE', 'HIDDEN', 'DRAFT'].includes(String(h.status || 'ACTIVE').toUpperCase())) continue;
      if (String(h.source_type || 'own') !== 'own' || hasRooms(h.hotel_id)) continue;
      const city = String(h.city || '');
      const country = String(h.country || '') || hotelCountryOf(city);
      const holy = city === 'MAKKAH' || city.includes('مكة') ? 'MAKKAH' : city === 'MADINAH' || city.includes('المدينة') ? 'MADINAH' : '';
      const priceKey = holy || country;
      if (!BASE[priceKey]) continue;
      const digit = Number(String(h.stars || h.category || '').match(/(\d)/)?.[1]);
      const stars: 4 | 5 = digit >= 5 || String(h.category).toUpperCase() === 'VIP' ? 5 : 4;
      addRooms(db, h.hotel_id, priceKey, stars, { makkah: holy === 'MAKKAH', view: holy ? 'بإطلالة على المدينة' : undefined });
      db.prepare(`
        UPDATE hotels SET bookable = 1, country = ?, stars = ?,
          check_in_time = COALESCE(NULLIF(check_in_time, ''), '16:00'),
          check_out_time = COALESCE(NULLIF(check_out_time, ''), '12:00'),
          policies = COALESCE(NULLIF(policies, ''), ?)
        WHERE hotel_id = ?
      `).run(holy ? 'SA' : country, stars, POLICIES, h.hotel_id);
    }

    // 2. Two sample hotels per destination city.
    const ins = db.prepare(`
      INSERT OR IGNORE INTO hotels (hotel_id, name, city, category, address, description, services, images, status,
        country, area, stars, check_in_time, check_out_time, policies, source_type, source_id, bookable)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, '14:00', '12:00', ?, 'sample', ?, 1)
    `);
    for (const s of sampleHotels()) {
      const country = DESTINATIONS.find((d) => d.id === s.country);
      ins.run(s.id, s.name, s.city, `${s.stars}_STAR`, `${s.area}، ${s.city}، ${country?.label || ''}`, s.description,
        JSON.stringify(s.services), JSON.stringify(s.images), s.country, s.area, s.stars, POLICIES, SEED_KEY);
      if (!hasRooms(s.id)) addRooms(db, s.id, s.country, s.stars, { view: s.view });
    }

    db.prepare('INSERT INTO hotel_seeds (seed_key, applied_at) VALUES (?, ?)').run(SEED_KEY, new Date().toISOString());
  })();
}

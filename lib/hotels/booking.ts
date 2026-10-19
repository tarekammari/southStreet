/**
 * Hotel-only booking → a reservation (booking_kind = HOTEL), so it follows
 * the agency's usual path: the Admin accepts, the accountant records the
 * deposit (same segregation-of-duties rules), finance counts it under «فنادق».
 * Rooms are held from the request on; a rejected / cancelled booking frees them.
 */
import { getSqliteDb } from '@/lib/sqlite';
import { dbLogAudit } from '@/lib/db';
import { DEPOSIT_PERCENT } from '@/lib/booking-catalog';
import { documentVerifyCode } from '@/lib/booking-documents';
import { getReservationById, nextReservationNumber } from '@/lib/booking';
import { ensureHotelSchema } from '@/lib/hotels/store';
import { HotelSearchError, repriceSelection } from '@/lib/hotels/engine';
import { BOARD_LABEL, arDate, type HotelSearch, type HotelStay } from '@/lib/hotels/types';
import type { BookingInvoice, Reservation } from '@/types';

export type HotelBookingInput = {
  hotelId: string;
  search: HotelSearch;
  offerIds: string[];
  guests: { name: string; passport?: string }[];
  phone: string;
  requests?: string;
};

export function createHotelBooking(
  input: HotelBookingInput,
  customer: { id: string; name: string; email?: string; phone?: string },
  actor: { name: string; role: string; onBehalf: boolean; ip?: string }
): Reservation {
  ensureHotelSchema();
  const lead = input.guests.find((g) => String(g.name || '').trim().length >= 4);
  if (!lead) throw new HotelSearchError('اكتب الاسم الكامل للضيف كما في جواز السفر');
  const phone = String(input.phone || customer.phone || '').trim();
  if (phone.replace(/\D/g, '').length < 8) throw new HotelSearchError('رقم الهاتف مطلوب');

  const { detail, chosen } = repriceSelection(input.hotelId, input.search, input.offerIds);
  const nights = detail.nights;
  const total = chosen.reduce((s, o) => s + o.total, 0);
  const deposit = Math.round(total * DEPOSIT_PERCENT);
  // The strictest room decides: one non-refundable room makes the booking non-refundable.
  const freeUntil = chosen.every((o) => o.free_cancel_until)
    ? chosen.map((o) => o.free_cancel_until as string).sort()[0]
    : null;

  const stay: HotelStay = {
    hotel_id: detail.hotel_id,
    supplier: 'own',
    hotel_name: detail.name,
    city: detail.city_label,
    country: detail.country_label,
    check_in: input.search.checkIn,
    check_out: input.search.checkOut,
    nights,
    rooms: chosen.map((o, i) => ({
      room_id: o.room_id,
      room_name: o.room_name,
      board: o.board,
      adults: input.search.rooms[i].adults,
      children: input.search.rooms[i].children,
      child_ages: input.search.rooms[i].childAges,
      total: o.total,
    })),
    free_cancel_until: freeUntil,
    guests: input.guests
      .map((g) => ({ name: String(g.name || '').trim().slice(0, 80), passport: String(g.passport || '').trim().slice(0, 20) || undefined }))
      .filter((g) => g.name),
    requests: String(input.requests || '').trim().slice(0, 500) || undefined,
  };

  const invoice: BookingInvoice = {
    lines: chosen.map((o, i) => ({
      id: `room_${i + 1}`,
      title: `${o.room_name} — ${BOARD_LABEL[o.board]}`,
      detail: `${nights} ${nights === 1 ? 'ليلة' : 'ليالٍ'} · ${input.search.rooms[i].adults} بالغ${input.search.rooms[i].children ? ` + ${input.search.rooms[i].children} طفل` : ''}`,
      amount: o.total,
    })),
    extrasTotal: 0,
    total,
    depositPercent: Math.round(DEPOSIT_PERCENT * 100),
    depositAmount: deposit,
    remainingAmount: total,
    currency: 'DZD',
  };

  const packageName = `حجز فندق — ${detail.name}`;
  const program = {
    package_id: `hotel:${detail.hotel_id}`,
    package_name: packageName,
    start_date: input.search.checkIn,
    end_date: input.search.checkOut,
    duration_days: nights,
    airline: '',
    departure_city: '',
    departure_airport: '',
    arrival_airport: '',
    makkah_hotel_name: '',
    makkah_hotel_dist: '',
    madinah_hotel_name: '',
    madinah_hotel_dist: '',
    hotel_category: detail.stars ? `${detail.stars}_STAR` : '',
    included_services: [],
    room_type: 'HOTEL',
    room_label: chosen.map((o) => o.room_name).join(' + '),
  };
  const appointments = [
    { id: 'check_in', title: `الوصول إلى ${detail.name}`, when: `${arDate(input.search.checkIn, { weekday: 'long', day: 'numeric', month: 'long' })}${detail.check_in_time ? ` — من ${detail.check_in_time}` : ''}`, place: `${detail.city_label}، ${detail.country_label}` },
    { id: 'check_out', title: 'المغادرة', when: `${arDate(input.search.checkOut, { weekday: 'long', day: 'numeric', month: 'long' })}${detail.check_out_time ? ` — قبل ${detail.check_out_time}` : ''}`, place: detail.name },
  ];

  const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const number = nextReservationNumber();
  const now = new Date().toISOString();
  getSqliteDb()
    .prepare(`
      INSERT INTO reservations (
        reservation_id, reservation_number, customer_id, customer_name, customer_email, customer_phone,
        package_id, package_name, room_type, travelers_count, travelers, total_price, paid_amount,
        payment_status, reservation_status, created_at, updated_at, extras, invoice, appointments, program,
        document_verify_code, booking_kind, hotel_id, hotel_stay
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'HOTEL', ?, ?, ?, 0, 'PENDING', 'REQUESTED', ?, ?, '[]', ?, ?, ?, ?, 'HOTEL', ?, ?)
    `)
    .run(
      id, number, customer.id, lead.name.trim(), customer.email || '', phone,
      program.package_id, packageName,
      stay.rooms.reduce((s, r) => s + r.adults + r.children, 0),
      JSON.stringify(stay.guests?.map((g) => ({ first_name: g.name, last_name: '', passport_number: g.passport || '', passport_expiry: '', birth_date: '', gender: 'MALE', traveler_type: 'ADULT' })) || []),
      total, now, now,
      JSON.stringify(invoice), JSON.stringify(appointments), JSON.stringify(program),
      documentVerifyCode(number, 'request', total),
      detail.hotel_id, JSON.stringify(stay)
    );

  try {
    dbLogAudit(
      actor.name,
      actor.role,
      actor.onBehalf ? 'حجز فندق نيابة عن عميل' : 'طلب حجز فندق',
      `${number} — ${detail.name} — ${input.search.checkIn} → ${input.search.checkOut} — ${total.toLocaleString('ar-DZ')} دج`,
      actor.ip || ''
    );
  } catch {
    /* audit is best-effort */
  }
  return getReservationById(id) as Reservation;
}

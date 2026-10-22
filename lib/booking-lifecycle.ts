/**
 * What happens to bookings when their date arrives, run lazily from the
 * dashboard and client reads (at most every few minutes):
 *   - a request still not finally confirmed when its programme departs (or its
 *     hotel check-in day passes) with nothing paid is closed as EXPIRED: the seat
 *     is freed, the client is told, and they are a new client again (no active trip);
 *   - every confirmed traveller of a programme that is not over is in its
 *     SS Connect group with the guide and the agency.
 * Requests with money on them are left to the accountant.
 */
import { getSqliteDb } from '@/lib/sqlite';
import { daysUntilDeparture } from '@/lib/booking-catalog';
import { notifyPilgrimAndAgency, parseJson } from '@/lib/booking';
import { joinTripGroup } from '@/lib/trip-groups';
import { dbLogAudit } from '@/lib/db';

const EVERY_MS = 5 * 60_000;
const state = globalThis as typeof globalThis & { __ssBookingSweepAt?: number };

const UNCONFIRMED_SQL = `(
  reservation_status IN ('REQUESTED', 'PENDING', 'PAYMENT_PENDING')
  OR (reservation_status = 'CONFIRMED' AND IFNULL(paid_amount, 0) <= 0)
)`;

function arDay(value: string): string {
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

const isHotel = (row: any) => row.booking_type === 'HOTEL' || String(row.package_id || '').startsWith('hotel:');

function startDateOf(row: any): string {
  if (isHotel(row)) return String(parseJson<{ check_in?: string } | null>(row.hotel_stay, null)?.check_in || '');
  const fromProgram = parseJson<{ start_date?: string } | null>(row.program, null)?.start_date;
  if (fromProgram) return String(fromProgram);
  const pkg = getSqliteDb().prepare('SELECT start_date FROM packages WHERE package_id = ?').get(row.package_id) as { start_date?: string } | undefined;
  return String(pkg?.start_date || '');
}

function expire(row: any, startDate: string) {
  const db = getSqliteDb();
  const hotel = isHotel(row);
  const now = new Date().toISOString();
  const note = hotel
    ? `حلّ موعد الدخول إلى الفندق (${arDay(startDate)}) قبل اكتمال تأكيد الحجز. أُغلق الطلب تلقائياً دون أي خصم.`
    : `انطلق البرنامج (${arDay(startDate)}) قبل اكتمال تأكيد الطلب بالعربون. أُغلق الطلب تلقائياً دون أي خصم.`;

  db.transaction(() => {
    const changed = db.prepare(`
      UPDATE reservations SET reservation_status = 'EXPIRED', payment_status = 'UNPAID',
        agency_note = ?, agency_confirmed_by = COALESCE(agency_confirmed_by, 'النظام'), updated_at = ?
      WHERE reservation_id = ? AND ${UNCONFIRMED_SQL} AND IFNULL(paid_amount, 0) <= 0
    `).run(note, now, row.reservation_id).changes;
    if (changed && !hotel) {
      db.prepare(`
        UPDATE packages SET reserved = CASE WHEN reserved > 0 THEN reserved - 1 ELSE 0 END, available = available + 1
        WHERE package_id = ?
      `).run(row.package_id);
    }
  })();

  const what = hotel ? `حجز الفندق «${row.package_name}»` : `برنامج «${row.package_name}»`;
  notifyPilgrimAndAgency({
    customerId: row.customer_id,
    customerName: row.customer_name,
    reservationNumber: row.reservation_number,
    pilgrimText: `مرحباً ${row.customer_name}، انتهت فترة ${what} يوم ${arDay(startDate)} قبل أن يكتمل تأكيد طلبك ${row.reservation_number}، فأُغلق الطلب تلقائياً ولم يُخصم منك أي مبلغ. حسابك مفتوح كعميل جديد: اختر ${hotel ? 'فندقاً أو تاريخاً آخر' : 'برنامجاً قادماً'} وأرسل طلباً جديداً متى شئت، ونحن هنا لمساعدتك.`,
  });
  try {
    dbLogAudit('النظام', 'SYSTEM', hotel ? 'انتهاء حجز فندق دون تأكيد' : 'انتهاء طلب رحلة دون تأكيد', row.reservation_number, '127.0.0.1');
  } catch {
    /* optional */
  }
}

export function sweepBookingLifecycle(force = false): { expired: number; joined: number } {
  const result = { expired: 0, joined: 0 };
  const now = Date.now();
  if (!force && state.__ssBookingSweepAt && now - state.__ssBookingSweepAt < EVERY_MS) return result;
  state.__ssBookingSweepAt = now;

  try {
    const db = getSqliteDb();
    const open = db.prepare(`SELECT * FROM reservations WHERE ${UNCONFIRMED_SQL} AND IFNULL(paid_amount, 0) <= 0`).all() as any[];
    for (const row of open) {
      const start = startDateOf(row);
      const days = daysUntilDeparture(start);
      if (days === null || days >= 0) continue;
      expire(row, start);
      result.expired++;
    }

    const confirmed = db.prepare(`
      SELECT reservation_id, package_id FROM reservations
      WHERE reservation_status IN ('CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DOCUMENTS_PENDING', 'READY_FOR_TRAVEL')
    `).all() as { reservation_id: string; package_id: string | null }[];
    for (const r of confirmed) {
      if (String(r.package_id || '').startsWith('hotel:')) continue;
      if (joinTripGroup(r.reservation_id)?.added) result.joined++;
    }
  } catch (err) {
    console.error('[booking-lifecycle]', err);
  }
  return result;
}

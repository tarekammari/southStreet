/**
 * Guide workspace data: the programs a guide (morshid) is assigned to, the
 * clients booked on them, check-ins per stage, and group messages.
 * A guide only ever sees his own programs; no amounts are exposed.
 */
import { getSqliteDb } from './sqlite';
import { mapReservationRow } from './booking';
import { isTripOver, parseTripDate } from './booking-catalog';
import { toList } from './json-list';
import { ROOM_LABELS } from './booking-catalog';
import { isGuideStage, type GuideStageId } from './guide-stages';

export type GuideTraveler = { name: string; passport: boolean; type: string };
export type GuideBooking = {
  reservationId: string;
  number: string;
  customerId: string;
  name: string;
  phone: string;
  room: string;
  confirmed: boolean;
  travelers: GuideTraveler[];
  checkins: Partial<Record<GuideStageId, { at: number; by: string }>>;
};
export type GuideProgram = {
  packageId: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  airline: string;
  departureCity: string;
  makkahHotel: string;
  madinahHotel: string;
  state: 'upcoming' | 'ongoing' | 'past';
  daysToStart: number | null;
  bookings: GuideBooking[];
  pilgrims: number;
};

let ready = false;
function db() {
  const d = getSqliteDb();
  if (!ready) {
    d.exec(`CREATE TABLE IF NOT EXISTS guide_checkins (
      checkin_id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      reservation_id TEXT NOT NULL,
      stage_type TEXT NOT NULL,
      by_name TEXT,
      ts INTEGER NOT NULL
    )`);
    ready = true;
  }
  return d;
}

/** The staff profile (morshids.morshid_id) behind a login account. */
export function guideIdForUser(userId: string): string | null {
  const row = db().prepare('SELECT staffId FROM users WHERE id = ?').get(userId) as { staffId?: string } | undefined;
  return row?.staffId ? String(row.staffId) : null;
}

export function guideProfile(guideId: string) {
  const m = db().prepare('SELECT * FROM morshids WHERE morshid_id = ?').get(guideId) as any;
  if (!m) return null;
  return { id: guideId, name: String(m.name || ''), title: String(m.roleName || ''), photo: String(m.image || ''), languages: toList(m.languages) };
}

function dayDiff(date: Date | null): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function guidePrograms(guideId: string): GuideProgram[] {
  const d = db();
  const packages = (d.prepare('SELECT * FROM packages').all() as any[]).filter((p) => String(p.morshid_id || '') === guideId);
  if (!packages.length) return [];
  const ids = new Set(packages.map((p) => String(p.package_id)));
  const reservations = (d.prepare('SELECT * FROM reservations').all() as any[])
    .map(mapReservationRow)
    .filter((r) => ids.has(String(r.package_id)))
    .filter((r) => !['REJECTED', 'CANCELLED'].includes(String(r.status || '').toUpperCase()));
  const checkins = d.prepare('SELECT * FROM guide_checkins').all() as any[];

  return packages
    .map((p) => {
      const start = parseTripDate(p.start_date);
      const days = dayDiff(start);
      const over = isTripOver({ status: '', program: { start_date: p.start_date, end_date: p.end_date, duration_days: Number(p.duration_days) || 0 } });
      const state: GuideProgram['state'] = over ? 'past' : days !== null && days <= 0 ? 'ongoing' : 'upcoming';
      const bookings: GuideBooking[] = reservations
        .filter((r) => r.package_id === p.package_id)
        .map((r) => {
          const travelers = (Array.isArray(r.travelers) ? r.travelers : []).map((t: any) => ({
            name: [t?.first_name, t?.last_name].filter(Boolean).join(' ') || r.customer_name,
            passport: Boolean(String(t?.passport_number || '').trim()),
            type: String(t?.traveler_type || 'ADULT'),
          }));
          const mine: GuideBooking['checkins'] = {};
          for (const c of checkins) {
            if (c.reservation_id === r.reservation_id && c.package_id === p.package_id && isGuideStage(c.stage_type)) {
              mine[c.stage_type as GuideStageId] = { at: Number(c.ts) || 0, by: String(c.by_name || '') };
            }
          }
          return {
            reservationId: r.reservation_id,
            number: r.reservation_number,
            customerId: r.customer_id,
            name: r.customer_name,
            phone: r.customer_phone || '',
            room: ROOM_LABELS[r.room_type as keyof typeof ROOM_LABELS] || r.room_type,
            confirmed: ['CONFIRMED', 'APPROVED', 'PAID', 'COMPLETED'].includes(String(r.status || '').toUpperCase()),
            travelers: travelers.length ? travelers : [{ name: r.customer_name, passport: false, type: 'ADULT' }],
            checkins: mine,
          };
        });
      return {
        packageId: String(p.package_id),
        name: String(p.name || ''),
        type: String(p.type || ''),
        startDate: String(p.start_date || ''),
        // No end date saved: start + duration.
        endDate: String(p.end_date || (start && Number(p.duration_days) > 0 ? new Date(start.getTime() + Number(p.duration_days) * 86_400_000).toISOString().slice(0, 10) : '')),
        durationDays: Number(p.duration_days) || 0,
        airline: String(p.airline || ''),
        departureCity: String(p.departure_city || ''),
        makkahHotel: String(p.makkah_hotel_name || ''),
        madinahHotel: String(p.madinah_hotel_name || ''),
        state,
        daysToStart: days,
        bookings,
        pilgrims: bookings.reduce((n, b) => n + b.travelers.length, 0),
      };
    })
    .sort((a, b) => {
      const rank = { ongoing: 0, upcoming: 1, past: 2 } as const;
      return rank[a.state] - rank[b.state] || (a.state === 'past' ? -1 : 1) * ((a.daysToStart ?? 0) - (b.daysToStart ?? 0));
    });
}

export function setCheckin(guideId: string, input: { packageId: string; reservationId: string; stage: GuideStageId; done: boolean; byName: string }) {
  const program = guidePrograms(guideId).find((p) => p.packageId === input.packageId);
  if (!program || !program.bookings.some((b) => b.reservationId === input.reservationId)) throw new Error('NOT_YOURS');
  const id = `${input.packageId}|${input.reservationId}|${input.stage}`;
  const d = db();
  if (input.done) {
    d.prepare('INSERT OR REPLACE INTO guide_checkins (checkin_id, package_id, reservation_id, stage_type, by_name, ts) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, input.packageId, input.reservationId, input.stage, input.byName.slice(0, 80), Date.now());
  } else {
    d.prepare('DELETE FROM guide_checkins WHERE checkin_id = ?').run(id);
  }
}

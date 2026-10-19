import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/staff-gate';
import { getSqliteDb } from '@/lib/sqlite';
import { mapReservationRow } from '@/lib/booking';
import { ensureHotelSchema } from '@/lib/hotels/store';

export const dynamic = 'force-dynamic';

/** Staff: every hotel-only booking, soonest check-in first. */
export async function GET(req: NextRequest) {
  const gate = requireRole(req, ['SUPER_ADMIN', 'AGENCY_MANAGER', 'ACCOUNTANT', 'AGENCY_AGENT']);
  if ('error' in gate) return gate.error;
  ensureHotelSchema();
  const rows = (getSqliteDb().prepare("SELECT * FROM reservations WHERE booking_type = 'HOTEL'").all() as any[])
    .map(mapReservationRow)
    .sort((a, b) => String(a.hotel_stay?.check_in || '').localeCompare(String(b.hotel_stay?.check_in || '')));
  return NextResponse.json({ bookings: rows });
}

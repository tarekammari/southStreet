import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/staff-gate';
import { HotelSearchError } from '@/lib/hotels/engine';
import { decodeRooms, type HotelSearch } from '@/lib/hotels/types';
import type { LoginRole } from '@/lib/roles';

export const STAFF_ROLES: LoginRole[] = ['SUPER_ADMIN', 'AGENCY_MANAGER', 'ACCOUNTANT', 'AGENCY_AGENT'];

/** Who is asking (if anyone): staff see the sandbox supplier and non-public hotels. */
export function viewerOf(req: Request): { staff: boolean; gate: ReturnType<typeof requireSession> | null } {
  // Visitors without a session never hit the users table.
  if (!req.headers.get('authorization') && !/south_street_token=/.test(req.headers.get('cookie') || '')) return { staff: false, gate: null };
  const gate = requireSession(req);
  if ('error' in gate) return { staff: false, gate: null };
  return { staff: STAFF_ROLES.includes(gate.role), gate };
}

export function searchFromParams(p: URLSearchParams): HotelSearch {
  return {
    dest: String(p.get('dest') || '').slice(0, 80),
    checkIn: String(p.get('checkIn') || ''),
    checkOut: String(p.get('checkOut') || ''),
    rooms: decodeRooms(p.get('rooms')),
  };
}

export function hotelError(err: unknown) {
  if (err instanceof HotelSearchError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error('[hotels]', err);
  return NextResponse.json({ error: 'تعذّر تنفيذ الطلب' }, { status: 500 });
}

export const noStore = { 'Cache-Control': 'no-store' };

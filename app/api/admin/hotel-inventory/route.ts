import { NextRequest, NextResponse } from 'next/server';
import { ADMINS, requireRole } from '@/lib/staff-gate';
import { dbLogAudit } from '@/lib/db';
import {
  deleteRate,
  deleteRoom,
  getHotelRow,
  listHotelRows,
  listRates,
  listRoomDays,
  listRooms,
  saveHotelBooking,
  saveRate,
  saveRoom,
  setRoomDays,
} from '@/lib/hotels/store';

export const dynamic = 'force-dynamic';

/**
 * Hotel inventory (Super Admin / Admin): rooms, nightly rates by season and
 * meal plan, availability and stop-sale, and whether the hotel is bookable.
 *   GET                 → hotels with counts
 *   GET ?hotel_id=…     → one hotel with rooms, rates and day overrides
 *   POST {action, …}    → save_hotel | save_room | delete_room | save_rate | delete_rate | set_days
 */
export async function GET(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  const id = new URL(req.url).searchParams.get('hotel_id');
  if (!id) {
    const hotels = listHotelRows().map((h) => ({
      ...h,
      rooms: listRooms(h.hotel_id).length,
      rates: listRates(h.hotel_id).length,
    }));
    return NextResponse.json({ hotels });
  }
  const hotel = getHotelRow(id);
  if (!hotel) return NextResponse.json({ error: 'الفندق غير موجود' }, { status: 404 });
  const today = new Date().toISOString().slice(0, 10);
  const rooms = listRooms(id).map((r) => ({ ...r, days: listRoomDays(r.room_id).filter((d) => d.day_key >= today) }));
  return NextResponse.json({ hotel, rooms, rates: listRates(id) });
}

export async function POST(req: NextRequest) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  try {
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || '');
    let result: unknown = null;
    if (action === 'save_hotel') result = saveHotelBooking(String(b.hotel_id || ''), b);
    else if (action === 'save_room') result = { room_id: saveRoom(b) };
    else if (action === 'delete_room') deleteRoom(String(b.room_id || ''));
    else if (action === 'save_rate') result = { rate_id: saveRate(b) };
    else if (action === 'delete_rate') deleteRate(String(b.rate_id || ''));
    else if (action === 'set_days') setRoomDays(String(b.room_id || ''), String(b.from || ''), String(b.to || ''), { allotment: b.allotment ?? null, stop_sell: Boolean(b.stop_sell) });
    else return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
    try {
      dbLogAudit(String(gate.account.name || 'الإدارة'), gate.role, 'مخزون الفنادق', `${action} — ${b.hotel_id || b.room_id || b.rate_id || ''}`);
    } catch {
      /* optional */
    }
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'تعذّر الحفظ' }, { status: 400 });
  }
}

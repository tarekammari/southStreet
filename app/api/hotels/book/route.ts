import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/staff-gate';
import { getSqliteDb } from '@/lib/sqlite';
import { normalizeLoginRole } from '@/lib/roles';
import { resolveRequestIp } from '@/lib/security-threats';
import { createHotelBooking } from '@/lib/hotels/booking';
import { hotelError, STAFF_ROLES } from '@/lib/hotels/http';
import { decodeRooms } from '@/lib/hotels/types';

export const dynamic = 'force-dynamic';

/**
 * Book a hotel stay (signed-in). A client books for themself; staff book for
 * a client by passing customerId. Prices are re-computed on the server.
 */
export async function POST(req: NextRequest) {
  const gate = requireSession(req);
  if ('error' in gate) return gate.error;
  try {
    const body = await req.json().catch(() => ({}));
    const staff = STAFF_ROLES.includes(gate.role);
    let customer = gate.account;
    if (body.customerId) {
      if (!staff) return NextResponse.json({ error: 'الحجز لعميل آخر من صلاحية الموظفين' }, { status: 403 });
      customer = getSqliteDb().prepare('SELECT * FROM users WHERE id = ?').get(String(body.customerId)) as any;
      if (!customer || normalizeLoginRole(customer.role) !== 'PILGRIM_USER') {
        return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
      }
    } else if (staff) {
      return NextResponse.json({ error: 'اختر العميل الذي تحجز له' }, { status: 400 });
    }
    const reservation = createHotelBooking(
      {
        hotelId: String(body.hotelId || ''),
        search: {
          dest: '',
          checkIn: String(body.checkIn || ''),
          checkOut: String(body.checkOut || ''),
          rooms: decodeRooms(body.rooms),
        },
        offerIds: Array.isArray(body.offerIds) ? body.offerIds.map(String) : [],
        guests: Array.isArray(body.guests) ? body.guests.slice(0, 20) : [],
        phone: String(body.phone || ''),
        requests: body.requests,
      },
      { id: String(customer.id), name: String(customer.name || ''), email: customer.email, phone: customer.phone },
      {
        name: String(gate.account.name || 'مستخدم'),
        role: gate.role,
        onBehalf: Boolean(body.customerId),
        ip: resolveRequestIp({ forwarded: req.headers.get('x-forwarded-for'), realIp: req.headers.get('x-real-ip'), fallback: '127.0.0.1' }),
      }
    );
    return NextResponse.json(
      { reservation, message: 'أُرسل طلب الحجز — تؤكد الوكالة التوفر مع الفندق ثم يُسجَّل العربون' },
      { status: 201 }
    );
  } catch (err) {
    return hotelError(err);
  }
}

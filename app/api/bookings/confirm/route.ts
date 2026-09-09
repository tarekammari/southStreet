import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/request-auth';
import { getSqliteDb } from '@/lib/sqlite';
import { normalizeLoginRole } from '@/lib/roles';
import { dbLogAudit } from '@/lib/db';
import { resolveRequestIp } from '@/lib/security-threats';
import {
  confirmReservationByAgency,
  listAgencyDemandQueue,
  listRecentAgencyReservations,
  rejectReservationByAgency,
} from '@/lib/booking';

export const dynamic = 'force-dynamic';

const AGENCY_VIEW_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER', 'AGENCY_AGENT', 'ACCOUNTANT']);
const AGENCY_ACT_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER', 'AGENCY_AGENT']);

function requireAgencyStaff(req: NextRequest, acting = false) {
  const auth = getAuthUser(req);
  if (!auth) {
    return { error: NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 }) };
  }
  const db = getSqliteDb();
  const account = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.id) as any;
  const role = normalizeLoginRole(account?.role, { email: account?.email, roleName: account?.roleName });
  const allowed = acting ? AGENCY_ACT_ROLES : AGENCY_VIEW_ROLES;
  if (!allowed.has(role)) {
    return { error: NextResponse.json({ error: 'صلاحية تأكيد الطلبات للموظفين فقط' }, { status: 403 }) };
  }
  return { account, role };
}

export async function GET(req: NextRequest) {
  const gate = requireAgencyStaff(req);
  if ('error' in gate) return gate.error;
  const demands = listAgencyDemandQueue();
  const recent = listRecentAgencyReservations();
  return NextResponse.json({ pending: demands, demands, recent, count: demands.length });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireAgencyStaff(req, true);
    if ('error' in gate) return gate.error;
    const { account } = gate;

    const body = await req.json();
    const reservationId = String(body.reservationId || '').trim();
    const action = String(body.action || 'confirm').toLowerCase();
    const note = String(body.note || '').trim();

    if (!reservationId) {
      return NextResponse.json({ error: 'معرّف الطلب مطلوب' }, { status: 400 });
    }

    const staff = { id: account.id, name: account.name || 'موظف الوكالة' };
    let reservation;
    if (action === 'reject') {
      reservation = rejectReservationByAgency(reservationId, staff, note || undefined);
    } else {
      reservation = confirmReservationByAgency(reservationId, staff, note || undefined);
    }

    const ip = resolveRequestIp({
      forwarded: req.headers.get('x-forwarded-for'),
      realIp: req.headers.get('x-real-ip'),
      fallback: '127.0.0.1',
    });
    try {
      dbLogAudit(
        staff.name,
        gate.role,
        action === 'reject' ? 'رفض طلب عمرة' : 'تأكيد طلب عمرة',
        reservation.reservation_number,
        ip
      );
    } catch {
      /* optional */
    }

    return NextResponse.json({
      status: action === 'reject' ? 'REJECTED' : 'CONFIRMED',
      reservation,
    });
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }
    if (error?.message === 'INVALID_STATUS') {
      return NextResponse.json({ error: 'لا يمكن معالجة هذا الطلب في حالته الحالية' }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message || 'تعذّر معالجة الطلب' }, { status: 500 });
  }
}

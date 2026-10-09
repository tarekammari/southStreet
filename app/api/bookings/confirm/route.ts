import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/request-auth';
import { getSqliteDb } from '@/lib/sqlite';
import { normalizeLoginRole } from '@/lib/roles';
import { dbLogAudit } from '@/lib/db';
import { resolveRequestIp } from '@/lib/security-threats';
import {
  confirmReservationByAgency,
  listAgencyDemandQueue,
  listAwaitingDepositReservations,
  listRecentAgencyReservations,
  rejectReservationByAgency,
} from '@/lib/booking';
import { notifyBookingConfirmed } from '@/lib/notifications';

import { requireSession } from '@/lib/staff-gate';

export const dynamic = 'force-dynamic';

const AGENCY_VIEW_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER', 'AGENCY_AGENT', 'ACCOUNTANT']);
// Stage 1 (accept / reject a demand) belongs to the director only.
const AGENCY_ACT_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER']);
// Stage 2 (record the deposit) belongs to the accountant — separation of duties:
// whoever approves a demand is not the one booking its money.
const DEPOSIT_ROLES = new Set(['SUPER_ADMIN', 'ACCOUNTANT']);
const MAX_NOTE = 500;

function requireAgencyStaff(req: NextRequest, acting = false) {
  const session = requireSession(req);
  if ('error' in session) return session;
  const { account, role } = session;
  const allowed = acting ? AGENCY_ACT_ROLES : AGENCY_VIEW_ROLES;
  if (!allowed.has(role)) {
    return {
      error: NextResponse.json(
        { error: acting ? 'قبول أو رفض الطلبات من صلاحية المشرف فقط' : 'صلاحية متابعة الطلبات للموظفين فقط' },
        { status: 403 }
      ),
    };
  }
  return { account, role };
}

export async function GET(req: NextRequest) {
  const gate = requireAgencyStaff(req);
  if ('error' in gate) return gate.error;
  const demands = listAgencyDemandQueue();
  const awaitingDeposit = listAwaitingDepositReservations();
  const recent = listRecentAgencyReservations();
  return NextResponse.json({
    pending: demands,
    demands,
    awaitingDeposit,
    recent,
    count: demands.length,
    permissions: {
      role: gate.role,
      canApprove: AGENCY_ACT_ROLES.has(gate.role),
      canCollectDeposit: DEPOSIT_ROLES.has(gate.role),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireAgencyStaff(req, true);
    if ('error' in gate) return gate.error;
    const { account } = gate;

    const body = await req.json();
    const reservationId = String(body.reservationId || '').trim();
    const action = String(body.action || 'confirm').toLowerCase();
    const note = String(body.note || '').trim().slice(0, MAX_NOTE);
    if (action !== 'confirm' && action !== 'reject') {
      return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
    }

    if (!reservationId) {
      return NextResponse.json({ error: 'معرّف الطلب مطلوب' }, { status: 400 });
    }
    if (action === 'reject' && note.length < 3) {
      return NextResponse.json({ error: 'اكتب سبب الرفض — يصل إلى المعتمر' }, { status: 400 });
    }

    const staff = { id: account.id, name: account.name || 'موظف الوكالة' };
    let reservation;
    if (action === 'reject') {
      reservation = rejectReservationByAgency(reservationId, staff, note || undefined);
    } else {
      reservation = confirmReservationByAgency(reservationId, staff, note || undefined);
      notifyBookingConfirmed({
        reservationId: reservation?.reservation_id,
        reservationNumber: reservation?.reservation_number,
        customerName: reservation?.customer_name,
        packageName: reservation?.package_name,
      });
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
      status: action === 'reject' ? 'REJECTED' : reservation.status,
      reservation,
      message:
        action === 'reject'
          ? 'تم رفض الطلب وأُبلغ المعتمر بالسبب'
          : reservation.status === 'PAYMENT_PENDING'
            ? 'قُبل الطلب — التأكيد النهائي بعد تحصيل العربون من المحاسب'
            : 'تم التأكيد',
    });
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }
    if (error?.message === 'DEPOSIT_PAID') {
      return NextResponse.json(
        { error: 'سُجّل عربون لهذا الطلب. يتم الإلغاء مع استرجاع المبلغ من المحاسبة.' },
        { status: 409 }
      );
    }
    if (error?.message === 'INVALID_STATUS') {
      return NextResponse.json({ error: 'لا يمكن معالجة هذا الطلب في حالته الحالية' }, { status: 409 });
    }
    console.error('[bookings/confirm]', error);
    return NextResponse.json({ error: 'تعذّر معالجة الطلب' }, { status: 500 });
  }
}

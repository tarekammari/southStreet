import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireStepUp, SUPER_ONLY } from '@/lib/staff-gate';
import { addClientTrip, changeClientTrip, findActiveReservation, listBookablePrograms } from '@/lib/booking';
import { dbLogAudit } from '@/lib/db';
import { writeFinanceAuditLog } from '@/lib/finance-audit';
import { normalizeLoginRole } from '@/lib/roles';
import { getSqliteDb } from '@/lib/sqlite';
import { resolveRequestIp } from '@/lib/security-threats';

export const dynamic = 'force-dynamic';

/**
 * Super Admin: give a client an Umrah trip, or move their active trip to
 * another program / room (before departure; what was paid stays).
 *   GET  ?userId=…  → bookable programs + the client's active trip
 *   POST {userId, packageId, roomType} → add (no active trip) or change
 *        (change = price change → security-key step-up)
 */

function ipOf(req: NextRequest) {
  return resolveRequestIp({
    forwarded: req.headers.get('x-forwarded-for'),
    realIp: req.headers.get('x-real-ip'),
    fallback: '127.0.0.1',
  });
}

function clientOf(userId: string) {
  const user = getSqliteDb().prepare('SELECT id, name, role FROM users WHERE id = ?').get(userId) as any;
  if (!user || normalizeLoginRole(user.role) !== 'PILGRIM_USER') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  const userId = new URL(req.url).searchParams.get('userId') || '';
  const active = userId ? findActiveReservation(userId) : null;
  return NextResponse.json({
    programs: listBookablePrograms(),
    active: active
      ? {
          reservation_id: active.reservation_id,
          reservation_number: active.reservation_number,
          package_id: active.package_id,
          package_name: active.package_name,
          room_type: active.room_type,
          total: Number(active.total_amount) || 0,
          paid: Number(active.paid_amount) || 0,
          status: active.status,
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || '').trim();
    const packageId = String(body.packageId || '').trim();
    const roomType = String(body.roomType || '').trim().toUpperCase();
    if (!userId || !packageId || !roomType) {
      return NextResponse.json({ error: 'اختر البرنامج ونوع الغرفة' }, { status: 400 });
    }
    const client = clientOf(userId);
    if (!client) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });

    const staff = { id: String(gate.account.id), name: String(gate.account.name || 'المشرف العام') };
    const actor = { userId: staff.id, userName: staff.name, role: gate.role };
    const ip = ipOf(req);

    if (findActiveReservation(userId)) {
      // A price change on a live booking: fresh security-key tap.
      const stepUp = requireStepUp(req, gate);
      if (stepUp) return stepUp.error;
      const { before, after } = changeClientTrip(userId, packageId, roomType, staff);
      const summary = `تغيير برنامج ${client.name}: «${before.package_name}» ← «${after.package_name}» (${before.reservation_number})`;
      writeFinanceAuditLog({
        actor,
        action: 'update',
        entity: 'reservation',
        entity_id: after.reservation_id,
        before: { package: before.package_name, room: before.room_type, total: before.total_amount, paid: before.paid_amount },
        after: { package: after.package_name, room: after.room_type, total: after.total_amount, paid: after.paid_amount, summary_ar: summary },
      });
      try { dbLogAudit(staff.name, gate.role, 'تغيير برنامج عميل', summary, ip); } catch { /* optional */ }
      return NextResponse.json({ status: 'CHANGED', reservation: after, message: `نُقل ${client.name} إلى «${after.package_name}» وأُبلغ بذلك` });
    }

    const created = addClientTrip(userId, packageId, roomType, staff);
    const summary = `إضافة رحلة لـ${client.name}: «${created.package_name}» (${created.reservation_number})`;
    writeFinanceAuditLog({
      actor,
      action: 'create',
      entity: 'reservation',
      entity_id: created.reservation_id,
      before: null,
      after: { package: created.package_name, room: created.room_type, total: created.total_amount, summary_ar: summary },
    });
    try { dbLogAudit(staff.name, gate.role, 'إضافة رحلة لعميل', summary, ip); } catch { /* optional */ }
    return NextResponse.json({ status: 'ADDED', reservation: created, message: `أُضيفت رحلة «${created.package_name}» — بانتظار العربون عند المحاسب` }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'تعذّر حفظ الرحلة' }, { status: 400 });
  }
}

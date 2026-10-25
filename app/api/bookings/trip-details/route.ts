import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/staff-gate';
import { getSqliteDb } from '@/lib/sqlite';
import { dbLogAudit } from '@/lib/db';
import { getReservationById, selfManageGuard } from '@/lib/booking';
import { ensureHotelSchema } from '@/lib/hotels/store';
import { VISA_LABEL, VISA_STATUSES, type VisaStatus } from '@/lib/visa';
import type { LoginRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const STAFF: LoginRole[] = ['SUPER_ADMIN', 'AGENCY_MANAGER', 'ACCOUNTANT', 'AGENCY_AGENT'];
const VISA_STAFF: LoginRole[] = ['SUPER_ADMIN', 'AGENCY_MANAGER', 'AGENCY_AGENT'];

/**
 * Trip details after booking:
 *   {action: 'travelers', reservationId, travelers: [...]} — the client (own
 *     booking, before departure) or staff: who travels, with passport data;
 *   {action: 'visa', reservationId, status, note} — staff: visa follow-up.
 */
export async function POST(req: NextRequest) {
  const gate = requireSession(req);
  if ('error' in gate) return gate.error;
  ensureHotelSchema();
  try {
    const b = await req.json().catch(() => ({}));
    const res = getReservationById(String(b.reservationId || ''));
    if (!res) return NextResponse.json({ error: 'الحجز غير موجود' }, { status: 404 });
    const staff = STAFF.includes(gate.role);
    const own = res.customer_id === gate.account.id;
    const db = getSqliteDb();

    if (b.action === 'travelers') {
      if (!staff && !own) return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 });
      if (!staff) {
        const guard = selfManageGuard(res);
        if (!guard.ok) return NextResponse.json({ error: guard.reason || 'لا يمكن التعديل الآن' }, { status: 409 });
      }
      const list = (Array.isArray(b.travelers) ? b.travelers : []).slice(0, 12).map((t: any) => ({
        first_name: String(t.first_name || '').trim().slice(0, 40),
        last_name: String(t.last_name || '').trim().slice(0, 40),
        passport_number: String(t.passport_number || '').trim().toUpperCase().slice(0, 20),
        passport_expiry: String(t.passport_expiry || '').slice(0, 10),
        birth_date: String(t.birth_date || '').slice(0, 10),
        gender: t.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
        traveler_type: ['ADULT', 'CHILD', 'INFANT'].includes(t.traveler_type) ? t.traveler_type : 'ADULT',
      })).filter((t: any) => t.first_name);
      if (!list.length) return NextResponse.json({ error: 'أضف مسافراً واحداً على الأقل' }, { status: 400 });
      db.prepare('UPDATE reservations SET travelers = ?, travelers_count = ?, updated_at = ? WHERE reservation_id = ?')
        .run(JSON.stringify(list), list.length, new Date().toISOString(), res.reservation_id);
      try { dbLogAudit(String(gate.account.name || ''), gate.role, 'تحديث المسافرين', `${res.reservation_number} — ${list.length} مسافر`); } catch { /* optional */ }
      return NextResponse.json({ ok: true, reservation: getReservationById(res.reservation_id) });
    }

    if (b.action === 'visa') {
      if (!VISA_STAFF.includes(gate.role)) return NextResponse.json({ error: 'متابعة التأشيرة من صلاحية الوكالة' }, { status: 403 });
      const status = String(b.status || '') as VisaStatus;
      if (!VISA_STATUSES.includes(status)) return NextResponse.json({ error: 'حالة غير معروفة' }, { status: 400 });
      const note = String(b.note || '').trim().slice(0, 300);
      db.prepare('UPDATE reservations SET visa_status = ?, visa_note = ?, updated_at = ? WHERE reservation_id = ?')
        .run(status, note || null, new Date().toISOString(), res.reservation_id);
      try { dbLogAudit(String(gate.account.name || ''), gate.role, 'متابعة التأشيرة', `${res.reservation_number} — ${VISA_LABEL[status]}${note ? ` — ${note}` : ''}`); } catch { /* optional */ }
      return NextResponse.json({ ok: true, reservation: getReservationById(res.reservation_id) });
    }
    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'تعذّر الحفظ' }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/request-auth';
import { getSqliteDb } from '@/lib/sqlite';
import { normalizeLoginRole } from '@/lib/roles';
import { dbLogAudit } from '@/lib/db';
import { resolveRequestIp } from '@/lib/security-threats';
import {
  buildInvoice,
  extrasByIds,
  getOwnedReservation,
  getReservationById,
  loadPublishedPackage,
  roomPriceFor,
  ROOM_LABELS,
} from '@/lib/booking';
import {
  BookingDocType,
  BookingDocumentPayload,
  documentVerifyCode,
  renderBookingDocumentHtml,
  reservationDocumentPayload,
  signPrintToken,
  verifyPrintToken,
} from '@/lib/booking-documents';
import type { SignOptions } from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const AGENCY_ROLES = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER', 'AGENCY_AGENT', 'ACCOUNTANT']);

function draftRef(type: BookingDocType): string {
  const year = new Date().getFullYear();
  return type === 'quote' ? `QUOTE-${year}-${Date.now().toString().slice(-6)}` : `DRAFT-${year}-${Date.now().toString().slice(-6)}`;
}

function buildDraftPayload(body: any): BookingDocumentPayload | null {
  const type = String(body.type || 'quote') as BookingDocType;
  const step = Number(body.step) || undefined;
  const draft = body.draft || {};
  const packageId = String(draft.packageId || '').trim();
  const roomType = String(draft.roomType || '').toUpperCase();
  const extraIds = Array.isArray(draft.extraIds) ? draft.extraIds.map(String) : [];

  if (!packageId || !roomType) return null;
  const pkg = loadPublishedPackage(packageId);
  if (!pkg) return null;
  const roomAmount = roomPriceFor(pkg, roomType);
  if (roomAmount == null) return null;
  const extras = extrasByIds(extraIds);
  const invoice = buildInvoice(
    {
      id: `room_${roomType}`,
      title: `${pkg.name} — ${ROOM_LABELS[roomType] || roomType}`,
      detail: `${pkg.duration_days} يوماً · ${pkg.airline || ''}`,
      amount: roomAmount,
    },
    extras
  );
  const ref = draftRef(type);
  return {
    type,
    ref,
    step,
    customerName: String(draft.name || '').trim() || undefined,
    customerEmail: String(draft.email || '').trim() || undefined,
    customerPhone: String(draft.phone || '').trim() || undefined,
    packageName: pkg.name,
    packageId: pkg.package_id,
    roomType,
    roomLabel: ROOM_LABELS[roomType] || roomType,
    airline: pkg.airline,
    startDate: pkg.start_date,
    endDate: pkg.end_date,
    durationDays: pkg.duration_days,
    extras,
    invoice,
    reservationStatus: 'DRAFT',
    paymentStatus: 'PENDING',
    paidAmount: 0,
    issuedAt: new Date().toISOString(),
    verifyCode: documentVerifyCode(ref, type, invoice.total),
    watermark: type === 'quote'
      ? 'عرض سعر — غير ملزم للوكالة'
      : 'مسودة طلب — بانتظار الإرسال والتأكيد',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = String(body.type || 'quote') as BookingDocType;
    const reservationId = String(body.reservationId || '').trim();
    const auth = getAuthUser(req);

    let payload: BookingDocumentPayload | null = null;
    let expiresIn: SignOptions['expiresIn'] = '20m';

    if (reservationId) {
      if (!auth) {
        return NextResponse.json({ error: 'يلزم تسجيل الدخول لطباعة وثائق الطلب' }, { status: 401 });
      }
      const db = getSqliteDb();
      const account = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.id) as any;
      const role = normalizeLoginRole(account?.role, { email: account?.email, roleName: account?.roleName });
      const owned = getOwnedReservation(reservationId, auth.id);
      const staff = AGENCY_ROLES.has(role);
      const reservation = owned || (staff ? getReservationById(reservationId) : null);
      if (!reservation) {
        return NextResponse.json({ error: 'الطلب غير موجود أو غير مصرّح' }, { status: 404 });
      }
      payload = reservationDocumentPayload(reservation, type, {
        pilgrimCode: account?.code || account?.username,
        receiptId: body.receiptId,
      });
      expiresIn = ['confirmation', 'receipt', 'invoice'].includes(type) ? '7d' : '2h';
    } else {
      payload = buildDraftPayload(body);
      if (!payload) {
        return NextResponse.json({ error: 'بيانات المسودة غير كافية للطباعة' }, { status: 400 });
      }
    }

    const token = signPrintToken(payload, expiresIn);
    const ip = resolveRequestIp({
      forwarded: req.headers.get('x-forwarded-for'),
      realIp: req.headers.get('x-real-ip'),
      fallback: '127.0.0.1',
    });
    try {
      const actorRole = auth
        ? normalizeLoginRole(undefined, { email: undefined, roleName: auth.roleName })
        : 'GUEST';
      dbLogAudit(
        payload.customerName || auth?.name || 'زائر',
        actorRole,
        'إصدار وثيقة حجز',
        `${payload.type}:${payload.ref}`,
        ip
      );
    } catch {
      /* optional */
    }

    return NextResponse.json({
      token,
      printUrl: `/book/print?t=${encodeURIComponent(token)}`,
      ref: payload.ref,
      verifyCode: payload.verifyCode,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذّر إصدار الوثيقة' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token') || new URL(req.url).searchParams.get('t') || '';
  if (!token) {
    return NextResponse.json({ error: 'رمز الوثيقة مطلوب' }, { status: 400 });
  }
  const payload = verifyPrintToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'انتهت صلاحية الوثيقة أو الرمز غير صالح' }, { status: 403 });
  }
  const html = renderBookingDocumentHtml(payload);
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Doc-Ref': payload.ref || '',
      'X-Doc-Type': payload.type || '',
    },
  });
}

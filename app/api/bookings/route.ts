import { NextRequest, NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { getAuthUser } from '@/lib/request-auth';
import { attachGoogleId, ensureUserAccount, findUserByGoogleId, findUserForLogin } from '@/lib/accounts';
import { verifyGoogleIdToken } from '@/lib/google-id-token';
import { upsertUserSession } from '@/lib/presence';
import { generateDeviceFingerprint, verifyPassword } from '@/lib/security';
import { signToken } from '@/lib/auth';
import { LOGIN_ROLE_LABELS, normalizeLoginRole, postLoginPath } from '@/lib/roles';
import { dbLogAudit, dbSaveMessage, dbSaveReceipt } from '@/lib/db';
import { resolveRequestIp } from '@/lib/security-threats';
import { buildDmChatId } from '@/lib/chat-utils';
import {
  BOOKING_EXTRAS,
  applyReservationChanges,
  buildAppointments,
  buildInvoice,
  buildProgram,
  cancelCustomerReservation,
  extrasByIds,
  findActiveReservation,
  getOwnedReservation,
  isActiveReservation,
  listCustomerReservations,
  loadPublishedPackage,
  lookupMorshidPhone,
  mapReservationRow,
  nextReservationNumber,
  roomPriceFor,
  ROOM_LABELS,
} from '@/lib/booking';
import { documentVerifyCode } from '@/lib/booking-documents';

export const dynamic = 'force-dynamic';

function clientMeta(req: Request) {
  const headers = req.headers;
  const clientIp = resolveRequestIp({
    forwarded: headers.get('x-forwarded-for'),
    realIp: headers.get('x-real-ip'),
    fallback: '127.0.0.1',
  });
  const userAgent = headers.get('user-agent') || 'Mozilla/5.0';
  const acceptLang = headers.get('accept-language') || 'ar-DZ';
  const { pcPrint } = generateDeviceFingerprint(clientIp, userAgent, acceptLang);
  return { clientIp, userAgent, pcPrint };
}

function publicUser(user: any, pcPrint: string, clientIp: string) {
  const role = normalizeLoginRole(user.role, { email: user.email, roleName: user.roleName });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role,
    roleName: user.roleName || LOGIN_ROLE_LABELS[role],
    status: user.status,
    phone: user.phone,
    code: user.code,
    redirect: postLoginPath(role),
    lastLoginIp: clientIp,
    pcFingerprint: pcPrint,
  };
}

function issueSession(user: any, req: Request) {
  const meta = clientMeta(req);
  const sqlite = getSqliteDb();
  sqlite.prepare('UPDATE users SET lastLoginIp = ?, pcFingerprint = ? WHERE id = ?')
    .run(meta.clientIp, meta.pcPrint, user.id);

  try {
    upsertUserSession({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      ip: meta.clientIp,
      pcPrint: meta.pcPrint,
      userAgent: meta.userAgent,
    });
  } catch {
    /* session is optional for booking success */
  }

  const safeUser = publicUser(user, meta.pcPrint, meta.clientIp);
  const token = signToken({
    id: user.id,
    code: user.code || user.username || user.id,
    name: user.name,
    role: user.role,
    roleName: safeUser.roleName,
    email: user.email,
    username: user.username,
    phone: user.phone,
  });

  return { token, user: safeUser, ip: meta.clientIp };
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    first_name: parts[0] || fullName,
    last_name: parts.slice(1).join(' ') || parts[0] || '',
  };
}

function travelersFrom(name: string, passport: string) {
  const { first_name, last_name } = splitName(name);
  return [{
    first_name,
    last_name,
    passport_number: passport,
    passport_expiry: '',
    birth_date: '',
    gender: 'MALE' as const,
    traveler_type: 'ADULT' as const,
  }];
}

function parseBookingBody(body: any) {
  return {
    packageId: String(body.packageId || '').trim(),
    roomType: String(body.roomType || '').toUpperCase(),
    extraIds: Array.isArray(body.extraIds) ? body.extraIds.map(String) : [],
    name: String(body.name || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    password: String(body.password || ''),
    passport: String(body.passport || '').trim(),
    reservationId: String(body.reservationId || '').trim(),
  };
}

function validateDemand(input: ReturnType<typeof parseBookingBody>, { requireEmail }: { requireEmail: boolean }) {
  if (!input.packageId) return 'اختر باقة العمرة أولاً';
  if (!['SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'].includes(input.roomType)) return 'اختر نوع الغرفة';
  if (!input.name || input.name.length < 4) return 'أدخل اسمك';
  if (!input.phone) return 'رقم الهاتف مطلوب';
  if (requireEmail && (!input.email || !input.email.includes('@'))) return 'اربط حساب جوجل للمتابعة';
  return null;
}

function quoteDemand(packageId: string, roomType: string, extraIds: string[]) {
  const pkg = loadPublishedPackage(packageId);
  if (!pkg || pkg.published === false) {
    return { ok: false as const, error: 'هذه الباقة غير متاحة للحجز حالياً', status: 404 as const };
  }
  const roomAmount = roomPriceFor(pkg, roomType);
  if (roomAmount == null) {
    return { ok: false as const, error: 'سعر هذا النوع من الغرف غير متوفر', status: 400 as const };
  }
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
  return { ok: true as const, pkg, extras, invoice };
}

function notifyAgency(account: any, text: string, pkgName?: string) {
  try {
    const db = getSqliteDb();
    const agent = db.prepare("SELECT * FROM users WHERE id = 'usr_agent'").get() as any;
    if (agent) {
      dbSaveMessage({
        id: '',
        chatId: buildDmChatId(account.id, agent.id),
        senderId: agent.id,
        senderName: agent.name,
        senderAvatar: agent.avatar || 'س',
        senderRole: 'agent',
        text,
        time: '',
      });
    }
    if (pkgName) {
      const welcomeFrom = agent;
      if (welcomeFrom) {
        dbSaveMessage({
          id: '',
          chatId: 'group-campaign-makkah',
          senderId: welcomeFrom.id,
          senderName: welcomeFrom.name,
          senderAvatar: welcomeFrom.avatar || 'م',
          senderRole: 'agent',
          text,
          time: '',
        });
      }
    }
  } catch {
    /* chat is optional */
  }
}

function existingBookingResponse(account: any, req: Request, reservation: ReturnType<typeof findActiveReservation>) {
  const session = issueSession(account, req);
  const res = NextResponse.json({
    error: 'لديك طلب لم تؤكده الوكالة بعد. يمكنك متابعته أو تعديله أو إلغاءه ثم الحجز من جديد.',
    code: 'EXISTING_BOOKING',
    reservation,
    token: session.token,
    user: { ...session.user, redirect: '/book' },
  }, { status: 409 });
  res.cookies.set('south_street_token', session.token, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
  }

  const db = getSqliteDb();
  const account = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.id) as any;
  const reservations = listCustomerReservations(auth.id);
  const activeReservation = reservations.find((row) => isActiveReservation(row.status)) || null;

  const allReceipts = db.prepare('SELECT * FROM receipts').all() as any[];
  const receipts = allReceipts
    .filter((row) =>
      row.pilgrimCode === account?.code ||
      row.pilgrimName === account?.name ||
      reservations.some((res) => row.packageName === res.package_name && row.pilgrimName === res.customer_name)
    )
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return NextResponse.json({ reservations, receipts, activeReservation });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.website_hp && String(body.website_hp).trim()) {
      return NextResponse.json({ error: 'تم حظر الطلب' }, { status: 403 });
    }

    const packageId = String(body.packageId || '').trim();
    const roomType = String(body.roomType || '').toUpperCase();
    const extraIds = Array.isArray(body.extraIds) ? body.extraIds.map(String) : [];
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    let email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const passport = String(body.passport || '').trim();
    const googleIdToken = String(body.googleIdToken || '').trim();
    let googleProfile: Awaited<ReturnType<typeof verifyGoogleIdToken>> | null = null;
    if (googleIdToken) {
      try {
        googleProfile = await verifyGoogleIdToken(googleIdToken);
        email = googleProfile.email || email;
      } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'تعذر التحقق من حساب جوجل' }, { status: 400 });
      }
    }

    if (!packageId) return NextResponse.json({ error: 'اختر باقة العمرة أولاً' }, { status: 400 });
    if (!['SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'].includes(roomType)) {
      return NextResponse.json({ error: 'اختر نوع الغرفة' }, { status: 400 });
    }
    if (!name || name.length < 4) return NextResponse.json({ error: 'أدخل اسمك' }, { status: 400 });
    if (!phone) return NextResponse.json({ error: 'رقم الهاتف مطلوب' }, { status: 400 });

    const pkg = loadPublishedPackage(packageId);
    if (!pkg || pkg.published === false) {
      return NextResponse.json({ error: 'هذه الباقة غير متاحة للحجز حالياً' }, { status: 404 });
    }
    if (Number(pkg.available) < 1) {
      return NextResponse.json({ error: 'لا توجد مقاعد متبقية في هذه الباقة' }, { status: 409 });
    }

    const roomAmount = roomPriceFor(pkg, roomType);
    if (roomAmount == null) {
      return NextResponse.json({ error: 'سعر هذا النوع من الغرف غير متوفر' }, { status: 400 });
    }

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

    const auth = getAuthUser(req);
    const db = getSqliteDb();
    let account: any = null;

    if (auth) {
      account = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.id);
      const loginRole = normalizeLoginRole(account?.role, { email: account?.email, roleName: account?.roleName });
      if (account && loginRole !== 'PILGRIM_USER') {
        account = null;
      }
    }

    if (!account) {
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'اربط حساب جوجل للمتابعة' }, { status: 400 });
      }
      const existing = (googleProfile && findUserByGoogleId(googleProfile.googleId)) || findUserForLogin(email);
      if (existing) {
        const existingRole = normalizeLoginRole(existing.role, { email: existing.email, roleName: existing.roleName });
        if (existingRole !== 'PILGRIM_USER') {
          return NextResponse.json({
            error: 'هذا الحساب مرتبط بموظف. استخدم حساب جوجل آخر.',
          }, { status: 409 });
        }
        const googleOk = Boolean(googleProfile && (
          existing.googleId === googleProfile.googleId
          || existing.google_id === googleProfile.googleId
          || String(existing.email || '').toLowerCase() === googleProfile.email
        ));
        if (!googleOk && password && !verifyPassword(password, existing.passwordHash)) {
          return NextResponse.json({
            error: 'هذا الحساب مسجّل مسبقاً. سجّل الدخول ثم أعد المحاولة.',
          }, { status: 409 });
        }
        if (!googleOk && !password) {
          return NextResponse.json({
            error: 'هذا الحساب مسجّل مسبقاً. سجّل الدخول ثم أعد المحاولة.',
          }, { status: 409 });
        }
        if (googleProfile) attachGoogleId(existing.id, googleProfile.googleId);
        db.prepare(`
          UPDATE users SET status = 'APPROVED', loginEnabled = 1, name = ?, phone = COALESCE(NULLIF(?, ''), phone)
          WHERE id = ?
        `).run(name, phone, existing.id);
        account = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
      } else {
        const issued = ensureUserAccount({
          name,
          email,
          phone,
          role: 'PILGRIM_USER',
          roleName: 'معتمر',
          status: 'APPROVED',
          issueSecrets: false,
        });
        if (googleProfile) attachGoogleId(issued.userId, googleProfile.googleId);
        account = db.prepare('SELECT * FROM users WHERE id = ?').get(issued.userId);
      }
    }

    if (!account) {
      return NextResponse.json({ error: 'تعذّر إنشاء حساب المعتمر' }, { status: 500 });
    }

    const active = findActiveReservation(account.id);
    if (active) {
      return existingBookingResponse(account, req, active);
    }

    const now = new Date().toISOString();
    const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const reservationNumber = nextReservationNumber();
    const verifyCode = documentVerifyCode(reservationNumber, 'request', invoice.total);
    const { first_name, last_name } = splitName(name);
    const travelers = [{
      first_name,
      last_name,
      passport_number: passport,
      passport_expiry: '',
      birth_date: '',
      gender: 'MALE' as const,
      traveler_type: 'ADULT' as const,
    }];
    const appointments = buildAppointments(pkg);
    const program = buildProgram(pkg, roomType, lookupMorshidPhone(pkg.morshid_id));

    db.transaction(() => {
      db.prepare(`
        INSERT INTO reservations (
          reservation_id, reservation_number, customer_id, customer_name, customer_email, customer_phone,
          package_id, package_name, room_type, travelers_count, travelers, total_price, paid_amount,
          payment_status, reservation_status, created_at, updated_at, extras, invoice, appointments, program,
          document_verify_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reservationId,
        reservationNumber,
        account.id,
        name,
        account.email || email,
        phone || account.phone,
        pkg.package_id,
        pkg.name,
        roomType,
        1,
        JSON.stringify(travelers),
        invoice.total,
        0,
        'PENDING',
        'REQUESTED',
        now,
        now,
        JSON.stringify(extras),
        JSON.stringify(invoice),
        JSON.stringify(appointments),
        JSON.stringify(program),
        verifyCode
      );

      db.prepare(`
        UPDATE packages SET reserved = reserved + 1, available = CASE WHEN available > 0 THEN available - 1 ELSE 0 END
        WHERE package_id = ?
      `).run(pkg.package_id);
    })();

    try {
      const agent = db.prepare("SELECT * FROM users WHERE id = 'usr_agent'").get() as any;
      if (agent) {
        dbSaveMessage({
          id: '',
          chatId: buildDmChatId(account.id, agent.id),
          senderId: agent.id,
          senderName: agent.name,
          senderAvatar: agent.avatar || 'س',
          senderRole: 'agent',
          text: `مرحباً ${name}، استلمنا طلب عمرتك رقم ${reservationNumber}. فريق الوكالة يراجع الطلب ويؤكده خلال 24–48 ساعة. يمكنك طباعة طلب الحجز من بوابة المعتمر.`,
          time: '',
        });
        dbSaveMessage({
          id: '',
          chatId: buildDmChatId(account.id, agent.id),
          senderId: account.id,
          senderName: name,
          senderAvatar: name.charAt(0) || 'م',
          senderRole: 'pilgrim',
          text: `طلب جديد: ${pkg.name} — ${ROOM_LABELS[roomType] || roomType}. المجموع ${invoice.total.toLocaleString('ar-DZ')} دج. بانتظار تأكيد الوكالة.`,
          time: '',
        });
      }
    } catch {
      /* chat welcome is optional */
    }

    const session = issueSession(account, req);
    try {
      dbLogAudit(name, 'PILGRIM_USER', 'تقديم طلب عمرة', `${reservationNumber} — ${pkg.name}`, session.ip);
    } catch {
      /* audit optional */
    }

    const reservation = mapReservationRow(
      db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(reservationId)
    );

    const res = NextResponse.json({
      status: 'REQUESTED',
      token: session.token,
      user: { ...session.user, redirect: '/book' },
      reservation,
      extrasCatalog: BOOKING_EXTRAS,
      message: 'تم إرسال طلبك. ستتلقى تأكيد الوكالة قبل تفعيل الدفعة الأولى.',
    });
    res.cookies.set('south_street_token', session.token, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    return res;
  } catch (error: any) {
    console.error('[booking]', error);
    return NextResponse.json({ error: error?.message || 'تعذّر إتمام الحجز' }, { status: 500 });
  }
}

function requirePilgrimAccount(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 }) };
  const db = getSqliteDb();
  const account = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.id) as any;
  const role = normalizeLoginRole(account?.role, { email: account?.email, roleName: account?.roleName });
  if (!account || role !== 'PILGRIM_USER') {
    return { error: NextResponse.json({ error: 'هذه العملية متاحة لحساب المعتمر فقط' }, { status: 403 }) };
  }
  return { account };
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const gate = requirePilgrimAccount(req);
    if ('error' in gate) return gate.error;
    const account = gate.account;

    const input = parseBookingBody(body);
    const invalid = validateDemand(input, { requireEmail: true });
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    if (!input.reservationId) return NextResponse.json({ error: 'معرّف الطلب مطلوب للتعديل' }, { status: 400 });

    const existing = getOwnedReservation(input.reservationId, account.id);
    if (!existing) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

    const quoted = quoteDemand(input.packageId, input.roomType, input.extraIds);
    if (!quoted.ok) return NextResponse.json({ error: quoted.error }, { status: quoted.status });

    let reservation;
    try {
      reservation = applyReservationChanges({
        existing,
        pkg: quoted.pkg,
        roomType: input.roomType,
        extras: quoted.extras,
        invoice: quoted.invoice,
        name: input.name,
        phone: input.phone,
        email: account.email || input.email,
        travelers: travelersFrom(input.name, input.passport),
      });
    } catch (err: any) {
      if (err?.message === 'NO_SEATS') {
        return NextResponse.json({ error: 'لا توجد مقاعد متبقية في الباقة الجديدة' }, { status: 409 });
      }
      return NextResponse.json({ error: err?.message || 'تعذّر تعديل الطلب' }, { status: 409 });
    }

    const priceDelta = reservation.total_amount - existing.total_amount;
    notifyAgency(
      account,
      `تم تعديل طلب العمرة رقم ${reservation.reservation_number}. المجموع الجديد ${reservation.total_amount.toLocaleString('ar-DZ')} دج. ${reservation.status === 'REQUESTED' ? 'بانتظار إعادة تأكيد الوكالة.' : ''}`
    );

    return NextResponse.json({
      status: reservation.status === 'REQUESTED' ? 'REREQUESTED' : 'UPDATED',
      reservation,
      priceDelta,
      needsAgencyConfirmation: reservation.status === 'REQUESTED',
      user: { redirect: '/portal?tab=reservations' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذّر تعديل الطلب' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const gate = requirePilgrimAccount(req);
    if ('error' in gate) return gate.error;
    const account = gate.account;
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'معرّف الطلب مطلوب' }, { status: 400 });

    const existing = getOwnedReservation(id, account.id);
    if (!existing) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });

    let reservation;
    try {
      reservation = cancelCustomerReservation(existing);
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'تعذّر إلغاء الطلب' }, { status: 409 });
    }

    notifyAgency(
      account,
      `تم إلغاء طلب العمرة رقم ${reservation.reservation_number} (${reservation.package_name}) بناءً على طلب المعتمر.`
    );

    return NextResponse.json({
      status: 'CANCELLED',
      reservation,
      user: { redirect: '/book' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'تعذّر إلغاء الطلب' }, { status: 500 });
  }
}

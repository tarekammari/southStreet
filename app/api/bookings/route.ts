import { NextRequest, NextResponse } from 'next/server';
import { getSqliteDb } from '@/lib/sqlite';
import { getAuthUser } from '@/lib/request-auth';
import { ensureUserAccount, findUserForLogin } from '@/lib/accounts';
import { upsertUserSession } from '@/lib/presence';
import { generateDeviceFingerprint, verifyPassword } from '@/lib/security';
import { signToken } from '@/lib/auth';
import { LOGIN_ROLE_LABELS, normalizeLoginRole, postLoginPath } from '@/lib/roles';
import { dbLogAudit, dbSaveMessage, dbSaveReceipt } from '@/lib/db';
import { resolveRequestIp } from '@/lib/security-threats';
import { buildDmChatId } from '@/lib/chat-utils';
import {
  BOOKING_EXTRAS,
  buildAppointments,
  buildInvoice,
  buildProgram,
  extrasByIds,
  loadPublishedPackage,
  lookupMorshidPhone,
  mapReservationRow,
  nextReservationNumber,
  roomPriceFor,
  ROOM_LABELS,
} from '@/lib/booking';

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

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
  }

  const db = getSqliteDb();
  const account = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.id) as any;

  const rows = db.prepare(`
    SELECT * FROM reservations WHERE customer_id = ?
  `).all(auth.id) as any[];

  const reservations = rows
    .map(mapReservationRow)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  const allReceipts = db.prepare('SELECT * FROM receipts').all() as any[];
  const receipts = allReceipts
    .filter((row) =>
      row.pilgrimCode === account?.code ||
      row.pilgrimName === account?.name ||
      reservations.some((res) => row.packageName === res.package_name && row.pilgrimName === res.customer_name)
    )
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return NextResponse.json({ reservations, receipts });
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
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const passport = String(body.passport || '').trim();

    if (!packageId) return NextResponse.json({ error: 'اختر باقة العمرة أولاً' }, { status: 400 });
    if (!['SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'].includes(roomType)) {
      return NextResponse.json({ error: 'اختر نوع الغرفة' }, { status: 400 });
    }
    if (!name || name.length < 4) return NextResponse.json({ error: 'أدخل الاسم الكامل كما في الجواز' }, { status: 400 });
    if (!phone) return NextResponse.json({ error: 'رقم الهاتف مطلوب للتواصل' }, { status: 400 });
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'أدخل بريداً إلكترونياً صحيحاً' }, { status: 400 });

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
      const existing = findUserForLogin(email);
      if (existing) {
        const existingRole = normalizeLoginRole(existing.role, { email: existing.email, roleName: existing.roleName });
        if (existingRole !== 'PILGRIM_USER') {
          return NextResponse.json({
            error: 'هذا البريد مرتبط بحساب موظفين. استخدم بريداً آخر لحجز العمرة.',
          }, { status: 409 });
        }
        if (!password || !verifyPassword(password, existing.passwordHash)) {
          return NextResponse.json({
            error: 'هذا البريد مسجّل مسبقاً. أدخل كلمة المرور الصحيحة أو سجّل الدخول من بوابة الوكالة.',
          }, { status: 409 });
        }
        account = existing;
        db.prepare(`
          UPDATE users SET status = 'APPROVED', loginEnabled = 1, name = ?, phone = COALESCE(NULLIF(?, ''), phone)
          WHERE id = ?
        `).run(name, phone, existing.id);
        account = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
      } else {
        if (password.trim().length < 8) {
          return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, { status: 400 });
        }
        const issued = ensureUserAccount({
          name,
          email,
          password,
          phone,
          role: 'PILGRIM_USER',
          roleName: 'معتمر',
          status: 'APPROVED',
          issueSecrets: false,
        });
        account = db.prepare('SELECT * FROM users WHERE id = ?').get(issued.userId);
      }
    }

    if (!account) {
      return NextResponse.json({ error: 'تعذّر إنشاء حساب المعتمر' }, { status: 500 });
    }

    const now = new Date().toISOString();
    const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const reservationNumber = nextReservationNumber();
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
          payment_status, reservation_status, created_at, updated_at, extras, invoice, appointments, program
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        invoice.depositAmount,
        'PARTIALLY_PAID',
        'CONFIRMED',
        now,
        now,
        JSON.stringify(extras),
        JSON.stringify(invoice),
        JSON.stringify(appointments),
        JSON.stringify(program)
      );

      db.prepare(`
        UPDATE packages SET reserved = reserved + 1, available = CASE WHEN available > 0 THEN available - 1 ELSE 0 END
        WHERE package_id = ?
      `).run(pkg.package_id);
    })();

    const receipt = dbSaveReceipt({
      id: `RCP-${reservationNumber.replace('RES-', '')}`,
      pilgrimName: name,
      pilgrimCode: account.code || account.username || account.id,
      packageName: pkg.name,
      totalAmount: invoice.total,
      paidAmount: invoice.depositAmount,
      remainingAmount: invoice.remainingAmount,
      paymentMethod: 'دفعة تأكيد أولى (30%) — تحويل بريدي موب / CCP',
      date: now.slice(0, 10),
      accountantName: 'الأستاذ ياسين الفاسي',
      status: 'دفعة أولى',
    });

    try {
      const agent = db.prepare("SELECT * FROM users WHERE id = 'usr_agent'").get() as any;
      const guide = pkg.morshid_id
        ? (db.prepare('SELECT * FROM users WHERE staffId = ? OR name LIKE ?').get(pkg.morshid_id, `%${pkg.morshid_name || ''}%`) as any)
        : (db.prepare("SELECT * FROM users WHERE id = 'usr_guide'").get() as any);

      if (agent) {
        dbSaveMessage({
          id: '',
          chatId: buildDmChatId(account.id, agent.id),
          senderId: agent.id,
          senderName: agent.name,
          senderAvatar: agent.avatar || 'س',
          senderRole: 'agent',
          text: `مرحباً ${name}، تم تأكيد طلب عمرتك رقم ${reservationNumber}. الدفعة الأولى ${invoice.depositAmount.toLocaleString('ar-DZ')} دج، والمتبقي ${invoice.remainingAmount.toLocaleString('ar-DZ')} دج قبل السفر. فريق خدمة العملاء معك من هنا.`,
          time: '',
        });
      }

      const groupId = 'group-campaign-makkah';
      const welcomeFrom = guide || agent;
      if (welcomeFrom) {
        dbSaveMessage({
          id: '',
          chatId: groupId,
          senderId: welcomeFrom.id,
          senderName: welcomeFrom.name,
          senderAvatar: welcomeFrom.avatar || 'م',
          senderRole: welcomeFrom.id === 'usr_guide' ? 'murshid' : 'agent',
          text: `تم انضمام المعتمر ${name} إلى برنامج «${pkg.name}». موعد التجمع: ${appointments[0]?.when || pkg.start_date}.`,
          time: '',
        });
      }
    } catch {
      /* chat welcome is optional */
    }

    const session = issueSession(account, req);
    try {
      dbLogAudit(name, 'PILGRIM_USER', 'تأكيد حجز عمرة', `${reservationNumber} — ${pkg.name}`, session.ip);
    } catch {
      /* audit optional */
    }

    const reservation = mapReservationRow(
      db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(reservationId)
    );

    const res = NextResponse.json({
      status: 'SUCCESS',
      token: session.token,
      user: { ...session.user, redirect: '/portal?tab=program' },
      reservation,
      receipt,
      extrasCatalog: BOOKING_EXTRAS,
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

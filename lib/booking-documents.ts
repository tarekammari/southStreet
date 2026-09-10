import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt, { SignOptions } from 'jsonwebtoken';
import QRCode from 'qrcode';
import { BookingExtra, BookingInvoice, Reservation } from '@/types';
import { ROOM_LABELS, isAgencyConfirmed } from '@/lib/booking-catalog';

const JWT_SECRET = process.env.JWT_SECRET || 'south-street-secret-2026-key-prod';
const DOC_ISSUER = 'south-street-doc';

export type BookingDocType =
  | 'quote'
  | 'request'
  | 'invoice'
  | 'receipt'
  | 'confirmation';

export interface BookingDocumentPayload {
  type: BookingDocType;
  ref: string;
  step?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  packageName?: string;
  packageId?: string;
  roomType?: string;
  roomLabel?: string;
  airline?: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  extras?: BookingExtra[];
  invoice?: BookingInvoice;
  reservationStatus?: string;
  paymentStatus?: string;
  paidAmount?: number;
  agencyConfirmedAt?: string;
  agencyConfirmedBy?: string;
  pilgrimCode?: string;
  issuedAt?: string;
  verifyCode?: string;
  watermark?: string;
  trackUrl?: string;
}

export function documentVerifyCode(ref: string, type: string, total: number): string {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${ref}|${type}|${Math.round(total)}|south-street`)
    .digest('hex')
    .slice(0, 14)
    .toUpperCase();
}

export function signPrintToken(payload: BookingDocumentPayload, expiresIn: SignOptions['expiresIn'] = '20m'): string {
  return jwt.sign(
    { ...payload, purpose: 'booking-doc' } as jwt.JwtPayload,
    JWT_SECRET,
    { expiresIn, issuer: DOC_ISSUER }
  );
}

export function verifyPrintToken(token: string): BookingDocumentPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: DOC_ISSUER }) as BookingDocumentPayload & { purpose?: string };
    if (decoded.purpose !== 'booking-doc') return null;
    return decoded;
  } catch {
    return null;
  }
}

export function reservationDocumentPayload(
  reservation: Reservation,
  type: BookingDocType,
  extra?: { pilgrimCode?: string; receiptId?: string }
): BookingDocumentPayload {
  const total = reservation.invoice?.total ?? reservation.total_amount;
  const ref = type === 'receipt' && extra?.receiptId
    ? extra.receiptId
    : reservation.reservation_number;
  const verifyCode = documentVerifyCode(ref, type, total);
  const confirmed = isAgencyConfirmed(reservation.status);

  return {
    type,
    ref,
    customerName: reservation.customer_name,
    customerEmail: reservation.customer_email,
    customerPhone: reservation.customer_phone,
    packageName: reservation.package_name,
    packageId: reservation.package_id,
    roomType: reservation.room_type,
    roomLabel: reservation.program?.room_label || ROOM_LABELS[reservation.room_type] || reservation.room_type,
    airline: reservation.program?.airline,
    startDate: reservation.program?.start_date,
    endDate: reservation.program?.end_date,
    durationDays: reservation.program?.duration_days,
    extras: reservation.extras,
    invoice: reservation.invoice,
    reservationStatus: reservation.status,
    paymentStatus: reservation.payment_status,
    paidAmount: reservation.paid_amount,
    agencyConfirmedAt: (reservation as any).agency_confirmed_at,
    agencyConfirmedBy: (reservation as any).agency_confirmed_by,
    pilgrimCode: extra?.pilgrimCode,
    issuedAt: new Date().toISOString(),
    verifyCode,
    watermark: type === 'quote'
      ? 'عرض سعر — غير ملزم للوكالة'
      : !confirmed && (type === 'request' || type === 'invoice')
        ? 'بانتظار تأكيد الوكالة — وثيقة مؤقتة'
        : confirmed
          ? 'وثيقة معتمدة — ساوث ستريت للأسفار'
          : 'مسودة داخلية',
  };
}

function money(n?: number): string {
  return `${Math.round(Number(n) || 0).toLocaleString('ar-DZ')} دج`;
}

function formatShortDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function isPendingDemand(data: BookingDocumentPayload): boolean {
  if (isAgencyConfirmed(data.reservationStatus) || data.type === 'confirmation' || data.type === 'receipt') {
    return false;
  }
  return data.type === 'request'
    || data.type === 'invoice'
    || data.reservationStatus === 'REQUESTED'
    || data.reservationStatus === 'PENDING'
    || data.reservationStatus === 'DRAFT';
}

function extraNames(data: BookingDocumentPayload): string {
  const names = (data.extras || []).map((item) => item.title).filter(Boolean);
  return names.length ? names.join(' · ') : 'بدون إضافات';
}

let cachedAgencyLogo = '';

function agencyLogoDataUri(): string {
  if (cachedAgencyLogo) return cachedAgencyLogo;
  const files = [
    path.join(process.cwd(), 'images', 'south_street_logo_white_white.png'),
    path.join(process.cwd(), 'public', 'images', 'south_street_logo_white_white.png'),
    path.join(process.cwd(), 'images', 'south_street_logo_width.png'),
    path.join(process.cwd(), 'public', 'images', 'south_street_logo_width.png'),
  ];
  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      cachedAgencyLogo = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
      return cachedAgencyLogo;
    } catch {
      /* try next */
    }
  }
  return '';
}

function publicSiteBase(): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  return 'https://southstreet.dz';
}

export function requestTrackUrl(ref: string, origin?: string): string {
  const base = (origin || publicSiteBase()).replace(/\/$/, '');
  return `${base}/book?ref=${encodeURIComponent(ref)}`;
}

function resolveTrackUrl(data: BookingDocumentPayload): string {
  if (data.trackUrl) return data.trackUrl;
  return requestTrackUrl(data.ref);
}

type QrMatrix = { modules: { size: number; get: (x: number, y: number) => boolean } };

function requestQrDataUri(payload: string, sizePx = 80): string {
  const qr = (QRCode as unknown as {
    create: (text: string, opts?: { errorCorrectionLevel?: string }) => QrMatrix;
  }).create(payload, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  let d = '';
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      if (qr.modules.get(row, col)) d += `M${col} ${row}h1v1h-1z`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#ffffff"/><path fill="#0f172a" d="${d}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function displayTrackUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type DocTone = {
  banner: string;
  title: string;
  subtitle: string;
  notice?: string;
  noticeEm?: string;
  accent: string;
  soft: string;
  border: string;
  totalBg: string;
  totalColor: string;
};

function toneFor(data: BookingDocumentPayload): DocTone {
  const pending = isPendingDemand(data);
  if (pending || data.type === 'request') {
    return {
      banner: '#b45309',
      title: 'الطلب غير مؤكد',
      subtitle: 'هذه استمارة طلب فقط — ليست فاتورة وليست تأكيداً من الوكالة',
      notice: 'لم يتم تأكيد هذا الطلب بعد',
      noticeEm: 'الحجز والمقاعد والسعر النهائي لا تثبت إلا بعد موافقة الوكالة — امسح الرمز لمتابعة الطلب',
      accent: '#b45309',
      soft: '#fffbeb',
      border: '#fcd34d',
      totalBg: '#fff7ed',
      totalColor: '#9a3412',
    };
  }
  if (data.type === 'quote') {
    return {
      banner: '#334155',
      title: 'عرض سعر',
      subtitle: 'عرض تقديري فقط — غير ملزم حتى تأكيد الوكالة',
      notice: 'هذا العرض غير ملزم',
      noticeEm: 'الأسعار والمقاعد قابلة للتغيير حتى إرسال الطلب وتأكيده',
      accent: '#334155',
      soft: '#f8fafc',
      border: '#cbd5e1',
      totalBg: '#f1f5f9',
      totalColor: '#0f172a',
    };
  }
  if (data.type === 'receipt') {
    return {
      banner: '#0f766e',
      title: 'سند قبض',
      subtitle: 'إيصال دفعة مستلمة من الوكالة',
      accent: '#0f766e',
      soft: '#f0fdfa',
      border: '#99f6e4',
      totalBg: '#ccfbf1',
      totalColor: '#115e59',
    };
  }
  if (data.type === 'confirmation') {
    return {
      banner: '#047857',
      title: 'تأكيد الحجز',
      subtitle: 'وثيقة تأكيد رسمية من ساوث ستريت للأسفار',
      accent: '#047857',
      soft: '#ecfdf5',
      border: '#a7f3d0',
      totalBg: '#d1fae5',
      totalColor: '#065f46',
    };
  }
  return {
    banner: '#1e3a5f',
    title: 'فاتورة الحجز',
    subtitle: 'فاتورة برنامج العمرة — ساوث ستريت للأسفار',
    accent: '#1e3a5f',
    soft: '#f8fafc',
    border: '#cbd5e1',
    totalBg: '#eff6ff',
    totalColor: '#1e3a5f',
  };
}

function tableRows(pairs: Array<[string, string]>): string {
  return pairs.map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(value || '—')}</td>
    </tr>
  `).join('');
}

function renderSimpleDocument(data: BookingDocumentPayload): string {
  const tone = toneFor(data);
  const logoSrc = agencyLogoDataUri();
  const trackUrl = resolveTrackUrl(data);
  const qrSrc = requestQrDataUri([trackUrl, `REF:${data.ref}`, 'SOUTH STREET'].join('\n'));
  const year = new Date().getFullYear();
  const lines = data.invoice?.lines || [];
  const total = data.invoice?.total ?? lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const paid = Number(data.paidAmount || 0);
  const deposit = data.invoice?.depositAmount ?? Math.round(total * 0.3);
  const remaining = Math.max(0, total - (paid || 0));
  const isReceipt = data.type === 'receipt';
  const isQuote = data.type === 'quote';
  const isPending = isPendingDemand(data);

  const tripPairs: Array<[string, string]> = [
    ['البرنامج', data.packageName || '—'],
    ['الغرفة', data.roomLabel || data.roomType || '—'],
    ['السفر / العودة', `${formatShortDate(data.startDate)} — ${formatShortDate(data.endDate)}`],
    ['المدة', data.durationDays ? `${data.durationDays} يوماً` : '—'],
    ['الطيران', data.airline || '—'],
    ['الإضافات', extraNames(data)],
  ];

  const priceRows = isReceipt
    ? `
      <tr><td>المبلغ المستلم</td><td class="amt">${money(paid || total)}</td></tr>
      ${data.packageName ? `<tr><td>مقابل</td><td>${escapeHtml(data.packageName)}</td></tr>` : ''}
    `
    : (lines.length
      ? lines.map((line) => `
          <tr>
            <td>${escapeHtml(line.title)}</td>
            <td class="amt">${money(line.amount)}</td>
          </tr>
        `).join('')
      : `<tr><td>سعر البرنامج</td><td class="amt">${money(total)}</td></tr>`);

  const totalLabel = isReceipt
    ? 'المبلغ المستلم'
    : isPending || isQuote
      ? 'المجموع التقديري'
      : 'المجموع';

  const showPaySplit = !isReceipt && !isQuote && !isPending && total > 0;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(tone.title)} — ${escapeHtml(data.ref)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; }
    body { font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif; font-size: 12px; line-height: 1.5; }
    .form {
      width: 100%;
      max-width: 186mm;
      margin: 0 auto;
      min-height: 273mm;
      display: flex;
      flex-direction: column;
      border: 1px solid #e2e8f0;
    }
    .alert {
      background: ${tone.banner};
      color: #fff;
      text-align: center;
      padding: 14px 16px;
    }
    .alert strong {
      display: block;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 0.02em;
    }
    .alert span {
      display: block;
      margin-top: 4px;
      font-size: 12px;
      font-weight: 700;
      opacity: 0.95;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 28px;
      padding: 16px 20px 14px;
      border-bottom: 1px solid #e2e8f0;
    }
    .brand img {
      display: block;
      height: 72px;
      width: auto;
      max-width: 160px;
      object-fit: contain;
    }
    .qr-card { flex: 0 0 auto; text-align: center; }
    .qr-card img {
      width: 80px;
      height: 80px;
      display: block;
      background: #fff;
      padding: 3px;
      border: 1px solid #e2e8f0;
    }
    .qr-card span {
      display: block;
      margin-top: 5px;
      font-size: 8px;
      font-weight: 800;
      color: #64748b;
      white-space: nowrap;
    }
    .idline {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr 1.5fr;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .idline > div {
      padding: 9px 14px;
      border-left: 1px solid #e2e8f0;
      min-width: 0;
    }
    .idline > div:last-child { border-left: 0; }
    .idline span {
      display: block;
      font-size: 8px;
      font-weight: 800;
      color: #64748b;
      white-space: nowrap;
    }
    .idline b {
      display: block;
      margin-top: 3px;
      color: #0f172a;
      font-size: 12px;
      font-family: ui-monospace, Consolas, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .idline-url { direction: ltr; text-align: left; }
    .idline-url b { font-size: 9px; color: ${tone.accent}; }
    .notice {
      margin: 14px 16px 0;
      padding: 12px 14px;
      border: 2px solid ${tone.accent};
      background: ${tone.soft};
      color: ${tone.totalColor};
      font-weight: 700;
      text-align: center;
    }
    .notice em {
      display: block;
      margin-top: 4px;
      font-style: normal;
      font-size: 11px;
      font-weight: 800;
    }
    .section { padding: 14px 16px 0; }
    .section h3 {
      margin: 0 0 8px;
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.04em;
    }
    table.form-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    table.form-table th,
    table.form-table td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      text-align: right;
    }
    table.form-table th {
      width: 28%;
      background: #f8fafc;
      color: #64748b;
      font-size: 10px;
      font-weight: 800;
    }
    table.form-table td { font-weight: 700; color: #0f172a; }
    .amt { text-align: left; white-space: nowrap; font-weight: 800; }
    .total-row td {
      background: ${tone.totalBg};
      color: ${tone.totalColor};
      font-size: 13px;
      font-weight: 900;
    }
    .hint {
      margin: 12px 16px 0;
      font-size: 10px;
      color: #64748b;
      font-weight: 700;
      line-height: 1.6;
    }
    .signs {
      margin-top: auto;
      padding: 28px 16px 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .sign {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      font-size: 10px;
      color: #64748b;
      font-weight: 700;
    }
    .foot {
      padding: 8px 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #94a3b8;
    }
    @media print { .form { max-width: none; min-height: auto; border: 0; } }
  </style>
</head>
<body>
  <article class="form">
    <div class="alert">
      <strong>${escapeHtml(tone.title)}</strong>
      <span>${escapeHtml(tone.subtitle)}</span>
    </div>

    <header class="head">
      <div class="brand">
        ${logoSrc ? `<img src="${logoSrc}" alt="South Street" />` : '<strong>ساوث ستريت للأسفار</strong>'}
      </div>
      <div class="qr-card">
        <img src="${qrSrc}" alt="QR ${escapeHtml(data.ref)}" />
        <span>امسح للمتابعة</span>
      </div>
    </header>

    <div class="idline">
      <div>
        <span>رقم ${isReceipt ? 'السند' : 'الطلب'}</span>
        <b>${escapeHtml(data.ref)}</b>
      </div>
      <div>
        <span>التاريخ</span>
        <b>${escapeHtml(formatShortDate(data.issuedAt))}</b>
      </div>
      <div class="idline-url">
        <span dir="rtl">رابط المتابعة</span>
        <b title="${escapeHtml(trackUrl)}">${escapeHtml(displayTrackUrl(trackUrl))}</b>
      </div>
    </div>

    ${tone.notice ? `
    <div class="notice">
      ${escapeHtml(tone.notice)}
      ${tone.noticeEm ? `<em>${escapeHtml(tone.noticeEm)}</em>` : ''}
    </div>` : ''}

    <section class="section">
      <h3>بيانات أولية</h3>
      <table class="form-table">
        ${tableRows([
          ['الاسم', data.customerName || '—'],
          ['الهاتف', data.customerPhone || '—'],
        ])}
      </table>
    </section>

    ${!isReceipt ? `
    <section class="section">
      <h3>خيارات الرحلة</h3>
      <table class="form-table">${tableRows(tripPairs)}</table>
    </section>` : `
    <section class="section">
      <h3>تفاصيل الدفعة</h3>
      <table class="form-table">
        ${tableRows([
          ['البرنامج', data.packageName || '—'],
          ['السفر', `${formatShortDate(data.startDate)} — ${formatShortDate(data.endDate)}`],
        ])}
      </table>
    </section>`}

    <section class="section">
      <h3>${isReceipt ? 'المبلغ' : isPending || isQuote ? 'الأسعار التقديرية' : 'الأسعار'}</h3>
      <table class="form-table">
        ${priceRows}
        <tr class="total-row"><td>${escapeHtml(totalLabel)}</td><td class="amt">${money(isReceipt ? (paid || total) : total)}</td></tr>
        ${showPaySplit ? `
        <tr><td>المدفوع</td><td class="amt">${money(paid || deposit)}</td></tr>
        <tr><td>المتبقي</td><td class="amt">${money(remaining)}</td></tr>` : ''}
      </table>
    </section>

    <p class="hint">
      ${isPending || isQuote
        ? 'هذه الوثيقة لا تلزم الوكالة ولا تُعتمد للدفع أو للسفر. بعد التأكيد تصدر وثيقة رسمية.'
        : isReceipt
          ? 'احتفظ بهذا السند كإثبات دفع لدى الوكالة.'
          : 'وثيقة صادرة عن ساوث ستريت للأسفار — احتفظ بنسخة للمتابعة.'}
    </p>

    <div class="signs">
      <div class="sign">${isReceipt ? 'توقيع المستلم' : 'توقيع طالب الحجز'}</div>
      <div class="sign">ختم / توقيع الوكالة</div>
    </div>

    <footer class="foot">
      <span>© ${year} ساوث ستريت للأسفار</span>
      <span>${escapeHtml(data.ref)}</span>
    </footer>
  </article>
</body>
</html>`;
}

export function renderBookingDocumentHtml(data: BookingDocumentPayload): string {
  return renderSimpleDocument(data);
}

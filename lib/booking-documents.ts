import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt, { SignOptions } from 'jsonwebtoken';
import QRCode from 'qrcode';
import { BookingExtra, BookingInvoice, Reservation } from '@/types';
import { ROOM_LABELS, isAgencyConfirmed, paymentStatusLabel, reservationStatusLabel } from '@/lib/booking-catalog';

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

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function docTitle(type: BookingDocType): string {
  switch (type) {
    case 'quote': return 'عرض سعر العمرة';
    case 'request': return 'طلب حجز عمرة';
    case 'invoice': return 'فاتورة الحجز';
    case 'receipt': return 'سند قبض / دفعة';
    case 'confirmation': return 'تأكيد الوكالة — برنامج معتمد';
    default: return 'وثيقة الحجز';
  }
}

function docTypeCode(type: BookingDocType): string {
  switch (type) {
    case 'quote': return 'QUOTE';
    case 'request': return 'REQ';
    case 'invoice': return 'INV';
    case 'receipt': return 'RCP';
    case 'confirmation': return 'CNF';
    default: return 'DOC';
  }
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
  return data.type === 'request' || data.type === 'invoice' || data.reservationStatus === 'REQUESTED' || data.reservationStatus === 'PENDING' || data.reservationStatus === 'DRAFT';
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
  ];
  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      cachedAgencyLogo = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
      return cachedAgencyLogo;
    } catch {
      /* try next logo file */
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

function requestQrDataUri(payload: string, sizePx = 108): string {
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

function renderPendingRequestFormHtml(data: BookingDocumentPayload): string {
  const lines = data.invoice?.lines || [];
  const total = data.invoice?.total ?? lines.reduce((s, l) => s + l.amount, 0);
  const extrasTotal = data.invoice?.extrasTotal
    ?? (data.extras || []).reduce((s, item) => s + Number(item.price || 0), 0);
  const year = new Date().getFullYear();
  const logoSrc = agencyLogoDataUri();
  const trackUrl = resolveTrackUrl(data);
  const qrPayload = [
    trackUrl,
    `REF:${data.ref}`,
    'SOUTH STREET',
  ].join('\n');
  const qrSrc = requestQrDataUri(qrPayload);
  const optionRows = [
    ['البرنامج', data.packageName || '—'],
    ['الغرفة', data.roomLabel || data.roomType || '—'],
    ['السفر / العودة', `${formatShortDate(data.startDate)} — ${formatShortDate(data.endDate)}`],
    ['المدة', data.durationDays ? `${data.durationDays} يوماً` : '—'],
    ['الطيران', data.airline || '—'],
    ['الإضافات', extraNames(data)],
  ].map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(value)}</td>
    </tr>
  `).join('');

  const priceRows = lines.map((line) => `
    <tr>
      <td>${escapeHtml(line.title)}</td>
      <td class="amt">${money(line.amount)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>طلب غير مؤكد — ${escapeHtml(data.ref)}</title>
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
      background: #b45309;
      color: #fff;
      text-align: center;
      padding: 14px 16px;
    }
    .alert strong {
      display: block;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 0.04em;
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
    .brand {
      flex: 0 0 auto;
    }
    .brand img {
      display: block;
      height: 76px;
      width: auto;
      max-width: 168px;
      object-fit: contain;
    }
    .qr-card {
      flex: 0 0 auto;
      text-align: center;
    }
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
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .idline {
      display: grid;
      grid-template-columns: 1.15fr 0.95fr 1.5fr;
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
    .idline-url b { font-size: 9px; color: #047857; }
    .notice {
      margin: 14px 16px 0;
      padding: 12px 14px;
      border: 2px solid #b45309;
      background: #fffbeb;
      color: #7c2d12;
      font-weight: 700;
      text-align: center;
    }
    .notice em { display: block; margin-top: 4px; font-style: normal; font-size: 11px; font-weight: 800; }
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
    table.form-table th, table.form-table td {
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
    .total-row td { background: #fff7ed; color: #9a3412; font-size: 13px; font-weight: 900; }
    .hint {
      margin: 12px 16px 0;
      font-size: 10px;
      color: #92400e;
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
      <strong>الطلب غير مؤكد</strong>
      <span>هذه استمارة طلب فقط — ليست فاتورة وليست تأكيداً من الوكالة</span>
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
        <span>رقم الطلب</span>
        <b>${escapeHtml(data.ref)}</b>
      </div>
      <div>
        <span>تاريخ الاستمارة</span>
        <b>${escapeHtml(formatShortDate(data.issuedAt))}</b>
      </div>
      <div class="idline-url">
        <span dir="rtl">رابط المتابعة</span>
        <b title="${escapeHtml(trackUrl)}">${escapeHtml(displayTrackUrl(trackUrl))}</b>
      </div>
    </div>
    <div class="notice">
      لم يتم تأكيد هذا الطلب بعد
      <em>الحجز والمقاعد والسعر النهائي لا تثبت إلا بعد موافقة الوكالة — امسح الرمز لمتابعة الطلب</em>
    </div>
    <section class="section">
      <h3>بيانات أولية</h3>
      <table class="form-table">
        <tr><th>الاسم</th><td>${escapeHtml(data.customerName || '—')}</td></tr>
        <tr><th>الهاتف</th><td dir="ltr">${escapeHtml(data.customerPhone || '—')}</td></tr>
      </table>
    </section>
    <section class="section">
      <h3>خيارات الرحلة</h3>
      <table class="form-table">${optionRows}</table>
    </section>
    <section class="section">
      <h3>الأسعار التقديرية</h3>
      <table class="form-table">
        ${priceRows || `<tr><td>سعر البرنامج</td><td class="amt">${money(total)}</td></tr>`}
        ${extrasTotal && !priceRows ? `<tr><td>الإضافات</td><td class="amt">${money(extrasTotal)}</td></tr>` : ''}
        <tr class="total-row"><td>المجموع التقديري</td><td class="amt">${money(total)}</td></tr>
      </table>
    </section>
    <p class="hint">
      هذه الوثيقة لا تلزم الوكالة ولا تُعتمد للدفع أو للسفر. بعد التأكيد تصدر وثيقة رسمية بالأسعار النهائية.
    </p>
    <div class="signs">
      <div class="sign">توقيع طالب الحجز</div>
      <div class="sign">ختم / توقيع الوكالة بعد التأكيد</div>
    </div>
    <footer class="foot">
      <span>© ${year} ساوث ستريت للأسفار — وثيقة غير مؤكدة</span>
      <span>${escapeHtml(data.ref)}</span>
    </footer>
  </article>
</body>
</html>`;
}

export function renderBookingDocumentHtml(data: BookingDocumentPayload): string {
  if (isPendingDemand(data)) {
    return renderPendingRequestFormHtml(data);
  }
  const lines = data.invoice?.lines || [];
  const total = data.invoice?.total ?? lines.reduce((s, l) => s + l.amount, 0);
  const deposit = data.invoice?.depositAmount ?? Math.round(total * 0.3);
  const remaining = data.invoice?.remainingAmount ?? Math.max(0, total - (data.paidAmount ?? deposit));
  const statusAr = reservationStatusLabel(data.reservationStatus);
  const payAr = paymentStatusLabel(data.paymentStatus);
  const confirmed = isAgencyConfirmed(data.reservationStatus) || data.type === 'confirmation';
  const typeCode = docTypeCode(data.type);
  const year = new Date().getFullYear();

  const rows = lines.map((line) => `
    <tr>
      <td class="col-item">
        <span class="item-title">${escapeHtml(line.title)}</span>
        ${line.detail ? `<span class="item-detail">${escapeHtml(line.detail)}</span>` : ''}
      </td>
      <td class="col-amt">${money(line.amount)}</td>
    </tr>
  `).join('');

  const showFinancials = lines.length > 0 || total > 0;
  const showDepositBlock = data.type !== 'receipt' && data.type !== 'quote';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(docTitle(data.type))} — ${escapeHtml(data.ref)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; }
    body {
      font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif;
      font-size: 11px;
      line-height: 1.45;
    }
    .doc {
      width: 100%;
      max-width: 186mm;
      margin: 0 auto;
      min-height: 277mm;
      display: flex;
      flex-direction: column;
    }
    .ribbon {
      background: linear-gradient(90deg, #065f46, #047857);
      color: #ecfdf5;
      text-align: center;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.02em;
      padding: 6px 10px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding: 14px 0 12px;
      border-bottom: 2px solid #047857;
    }
    .brand-block h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 900;
      color: #047857;
      letter-spacing: -0.02em;
    }
    .brand-block p {
      margin: 4px 0 0;
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }
    .doc-badge {
      display: inline-block;
      margin-top: 8px;
      padding: 3px 8px;
      border-radius: 4px;
      background: #ecfdf5;
      color: #047857;
      font-size: 9px;
      font-weight: 800;
      border: 1px solid #a7f3d0;
    }
    .meta-block {
      text-align: left;
      min-width: 160px;
      font-size: 10px;
      color: #475569;
    }
    .meta-block div { margin-bottom: 3px; }
    .meta-block strong { color: #94a3b8; font-weight: 700; }
    .title-row {
      padding: 12px 0 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .title-row h1 {
      margin: 0;
      font-size: 17px;
      font-weight: 900;
      color: #0f172a;
    }
    .title-row small {
      color: #64748b;
      font-size: 10px;
      display: block;
      margin-top: 3px;
      font-weight: 600;
    }
    ${confirmed ? `
    .stamp {
      width: 72px;
      height: 72px;
      border: 2px dashed #059669;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 8px;
      font-weight: 900;
      color: #047857;
      transform: rotate(-12deg);
      flex-shrink: 0;
      line-height: 1.2;
      padding: 6px;
    }` : '.stamp { display: none; }'}
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }
    .info-cell {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      background: #fafafa;
    }
    .info-cell label {
      display: block;
      font-size: 8px;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      margin-bottom: 3px;
      letter-spacing: 0.04em;
    }
    .info-cell span {
      font-size: 10px;
      font-weight: 700;
      color: #1e293b;
      word-break: break-word;
    }
    .info-cell.wide { grid-column: span 2; }
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 10px;
    }
    table.items thead th {
      background: #f1f5f9;
      color: #475569;
      font-size: 9px;
      font-weight: 800;
      padding: 7px 8px;
      border-bottom: 2px solid #cbd5e1;
      text-align: right;
    }
    table.items thead th.col-amt { text-align: left; }
    table.items td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    table.items .col-amt {
      text-align: left;
      white-space: nowrap;
      font-weight: 800;
      color: #0f172a;
      width: 88px;
    }
    .item-title { display: block; font-weight: 700; color: #0f172a; }
    .item-detail { display: block; font-size: 9px; color: #94a3b8; margin-top: 2px; }
    .summary {
      display: flex;
      justify-content: flex-end;
      margin-top: 6px;
    }
    .summary-box {
      width: min(240px, 100%);
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 7px 12px;
      font-size: 10px;
      border-bottom: 1px solid #f1f5f9;
    }
    .summary-row:last-child { border-bottom: 0; }
    .summary-row.grand {
      background: #ecfdf5;
      font-size: 12px;
      font-weight: 900;
      color: #047857;
    }
    .verify-bar {
      margin-top: auto;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      background: linear-gradient(180deg, #f8fafc, #f1f5f9);
    }
    .verify-text {
      font-size: 9px;
      color: #475569;
      line-height: 1.55;
      flex: 1;
    }
    .verify-text strong { color: #0f172a; }
    .verify-code {
      text-align: center;
      min-width: 120px;
      padding: 8px 10px;
      background: #fff;
      border: 1px dashed #047857;
      border-radius: 6px;
    }
    .verify-code label {
      display: block;
      font-size: 8px;
      color: #64748b;
      font-weight: 800;
      margin-bottom: 4px;
    }
    .verify-code code {
      font-family: ui-monospace, 'Courier New', monospace;
      font-size: 11px;
      font-weight: 900;
      color: #047857;
      letter-spacing: 1.5px;
    }
    .footer {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #94a3b8;
    }
    .agency-note {
      margin: 8px 0;
      padding: 8px 10px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      font-size: 9px;
      color: #92400e;
    }
    @media print {
      html, body { background: #fff; }
      .doc { max-width: none; min-height: auto; }
    }
  </style>
</head>
<body>
  <article class="doc">
    <div class="ribbon">${escapeHtml(data.watermark || 'وثيقة رسمية — ساوث ستريت للأسفار')}</div>

    <header class="header">
      <div class="brand-block">
        <h2>ساوث ستريت للأسفار</h2>
        <p>وكالة معتمدة — عمرة وحج — الجزائر · RC: SS-TRAVEL-${year}</p>
        <span class="doc-badge">${escapeHtml(typeCode)} · ${escapeHtml(docTitle(data.type))}</span>
      </div>
      <div class="meta-block">
        <div><strong>المرجع</strong><br/>${escapeHtml(data.ref)}</div>
        <div><strong>تاريخ الإصدار</strong><br/>${formatDate(data.issuedAt)}</div>
        ${data.pilgrimCode ? `<div><strong>كود المعتمر</strong><br/>${escapeHtml(data.pilgrimCode)}</div>` : ''}
      </div>
    </header>

    <div class="title-row">
      <div>
        <h1>${escapeHtml(docTitle(data.type))}</h1>
        <small>وثيقة إلكترونية موقّعة — صالحة للطباعة والحفظ PDF</small>
      </div>
      ${confirmed ? '<div class="stamp">معتمد<br/>الوكالة</div>' : ''}
    </div>

    <section class="info-grid">
      <div class="info-cell wide">
        <label>المعتمر</label>
        <span>${escapeHtml(data.customerName || '—')}</span>
      </div>
      <div class="info-cell">
        <label>الهاتف</label>
        <span dir="ltr">${escapeHtml(data.customerPhone || '—')}</span>
      </div>
      <div class="info-cell wide">
        <label>البريد الإلكتروني</label>
        <span dir="ltr">${escapeHtml(data.customerEmail || '—')}</span>
      </div>
      <div class="info-cell wide">
        <label>الباقة / البرنامج</label>
        <span>${escapeHtml(data.packageName || '—')}</span>
      </div>
      <div class="info-cell">
        <label>نوع الغرفة</label>
        <span>${escapeHtml(data.roomLabel || data.roomType || '—')}</span>
      </div>
      <div class="info-cell">
        <label>الطيران</label>
        <span>${escapeHtml(data.airline || '—')}</span>
      </div>
      <div class="info-cell">
        <label>تاريخ السفر</label>
        <span>${formatShortDate(data.startDate)}</span>
      </div>
      <div class="info-cell">
        <label>تاريخ العودة</label>
        <span>${formatShortDate(data.endDate)}</span>
      </div>
      <div class="info-cell">
        <label>حالة الطلب</label>
        <span>${escapeHtml(statusAr)}</span>
      </div>
      <div class="info-cell">
        <label>حالة الدفع</label>
        <span>${escapeHtml(payAr)}</span>
      </div>
    </section>

    ${showFinancials ? `
    <table class="items">
      <thead>
        <tr>
          <th>البند / الوصف</th>
          <th class="col-amt">المبلغ</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary">
      <div class="summary-box">
        <div class="summary-row grand"><span>المجموع الكلي</span><span>${money(total)}</span></div>
        ${showDepositBlock ? `
        <div class="summary-row"><span>دفعة التأكيد (${data.invoice?.depositPercent ?? 30}٪)</span><span>${money(deposit)}</span></div>
        <div class="summary-row"><span>المدفوع</span><span>${money(data.paidAmount ?? 0)}</span></div>
        <div class="summary-row"><span>المتبقي قبل السفر</span><span>${money(remaining)}</span></div>` : ''}
        ${data.type === 'receipt' ? `
        <div class="summary-row"><span>المبلغ المستلم</span><span>${money(data.paidAmount ?? deposit)}</span></div>` : ''}
      </div>
    </div>` : ''}

    ${data.agencyConfirmedAt ? `
    <p class="agency-note">
      ✓ تأكيد الوكالة: ${formatDate(data.agencyConfirmedAt)} — ${escapeHtml(data.agencyConfirmedBy || 'فريق ساوث ستريت')}
    </p>` : ''}

    <div class="verify-bar">
      <div class="verify-text">
        <strong>أمان الوثيقة:</strong> هذا المستند محمي برمز تحقق HMAC فريد. أي تعديل على المحتوى يبطل صلاحيته.
        للتحقق لدى الوكالة قدّم الرمز أدناه. الهاتف: +213 21 55 44 33 · admin@southstreet.dz
      </div>
      <div class="verify-code">
        <label>رمز التحقق</label>
        <code>${escapeHtml(data.verifyCode || '')}</code>
      </div>
    </div>

    <footer class="footer">
      <span>© ${year} ساوث ستريت للأسفار والعمرة — جميع الحقوق محفوظة</span>
      <span>${escapeHtml(data.ref)} · ${escapeHtml(typeCode)}</span>
    </footer>
  </article>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

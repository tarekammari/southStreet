import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
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

export function renderBookingDocumentHtml(data: BookingDocumentPayload): string {
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

import crypto from 'crypto';
import { jwtSecret } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import jwt, { SignOptions } from 'jsonwebtoken';
import QRCode from 'qrcode';
import { BookingExtra, BookingInvoice, Reservation } from '@/types';
import { ROOM_LABELS, isAgencyConfirmed } from '@/lib/booking-catalog';
import { toolGetAgencySettings } from '@/lib/ai-tools';

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
    .createHmac('sha256', jwtSecret())
    .update(`${ref}|${type}|${Math.round(total)}|south-street`)
    .digest('hex')
    .slice(0, 14)
    .toUpperCase();
}

export function signPrintToken(payload: BookingDocumentPayload, expiresIn: SignOptions['expiresIn'] = '20m'): string {
  return jwt.sign(
    { ...payload, purpose: 'booking-doc' } as jwt.JwtPayload,
    jwtSecret(),
    { expiresIn, issuer: DOC_ISSUER }
  );
}

export function verifyPrintToken(token: string): BookingDocumentPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret(), { issuer: DOC_ISSUER }) as BookingDocumentPayload & { purpose?: string };
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

/** DD/MM/YYYY with plain digits: locale output mixes direction marks into printed dates. */
function formatShortDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}



let cachedAgencyLogo = '';

function agencyLogoDataUri(): string {
  if (cachedAgencyLogo) return cachedAgencyLogo;
  const files = [
    path.join(process.cwd(), 'public', 'images', 'south_street_logo_trans.png'),
    path.join(process.cwd(), 'images', 'south_street_logo_trans.png'),
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

type Agency = { name: string; legal: string; lines: string[]; contact: string[] };

function agencyLetterhead(): Agency {
  let row: any = {};
  try {
    row = toolGetAgencySettings() || {};
  } catch {
    /* settings table unavailable: plain header */
  }
  const name = String(row.agency_name || 'ساوث ستريت للأسفار').trim();
  const legal = String(row.legal_name || 'South Street Travel').trim();
  const place = [row.address, row.city, row.country].map((v: unknown) => String(v || '').trim()).filter(Boolean).join('، ');
  const contact = [row.phone, row.email, row.website].map((v: unknown) => String(v || '').trim()).filter(Boolean);
  return { name, legal, lines: place ? [place] : [], contact };
}

type DocKind = {
  title: string;
  english: string;
  state: { label: string; tone: 'amber' | 'green' | 'slate' | 'teal' | 'navy' };
  notice?: { title: string; text: string; tone: 'amber' | 'green' | 'slate' };
  watermark?: string;
};

function kindOf(data: BookingDocumentPayload): DocKind {
  const confirmed = isAgencyConfirmed(data.reservationStatus);
  switch (data.type) {
    case 'quote':
      return {
        title: 'عرض سعر',
        english: 'Quotation',
        state: { label: 'غير ملزم', tone: 'slate' },
        notice: { title: 'عرض تقديري', text: 'الأسعار والمقاعد قابلة للتغيير حتى إرسال الطلب وتأكيده من الوكالة.', tone: 'slate' },
        watermark: 'عرض سعر',
      };
    case 'request':
      return {
        title: 'استمارة طلب حجز',
        english: 'Booking request',
        state: confirmed ? { label: 'مؤكد', tone: 'green' } : { label: 'قيد المراجعة', tone: 'amber' },
        notice: confirmed
          ? undefined
          : { title: 'طلب غير مؤكد بعد', text: 'هذه استمارة طلب وليست فاتورة ولا تأكيداً. المقعد والسعر النهائي يثبتان بعد موافقة الوكالة.', tone: 'amber' },
        watermark: confirmed ? undefined : 'غير مؤكد',
      };
    case 'invoice':
      return confirmed
        ? { title: 'فاتورة', english: 'Invoice', state: { label: 'حجز مؤكد', tone: 'navy' } }
        : {
            title: 'فاتورة أولية',
            english: 'Proforma invoice',
            state: { label: 'بانتظار العربون', tone: 'amber' },
            notice: { title: 'قُبل طلبك — بقي العربون', text: 'يتأكد الحجز نهائياً عند تسديد العربون المبيّن أدناه لدى الوكالة.', tone: 'amber' },
            watermark: 'فاتورة أولية',
          };
    case 'receipt':
      return { title: 'سند قبض', english: 'Payment receipt', state: { label: 'مبلغ مستلم', tone: 'teal' } };
    case 'confirmation':
    default:
      return {
        title: 'تأكيد الحجز',
        english: 'Booking confirmation',
        state: { label: 'مؤكد', tone: 'green' },
        notice: { title: 'حجزك مؤكد', text: 'تؤكد ساوث ستريت للأسفار حجز المقعد في البرنامج المبيّن أدناه. احتفظ بهذه الوثيقة.', tone: 'green' },
      };
  }
}

const TONES = {
  amber: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', solid: '#b45309' },
  green: { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46', solid: '#047857' },
  slate: { bg: '#f8fafc', border: '#cbd5e1', text: '#334155', solid: '#475569' },
  teal: { bg: '#f0fdfa', border: '#5eead4', text: '#115e59', solid: '#0f766e' },
  navy: { bg: '#eef2ff', border: '#c7d2fe', text: '#1e1b4b', solid: '#12054a' },
} as const;

function renderSimpleDocument(data: BookingDocumentPayload): string {
  const kind = kindOf(data);
  const agency = agencyLetterhead();
  const logoSrc = agencyLogoDataUri();
  const trackUrl = resolveTrackUrl(data);
  const qrSrc = requestQrDataUri([trackUrl, `REF:${data.ref}`, data.verifyCode ? `CODE:${data.verifyCode}` : '', 'SOUTH STREET'].filter(Boolean).join('\n'), 96);
  const lines = data.invoice?.lines || [];
  const total = data.invoice?.total ?? lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const paid = Number(data.paidAmount || 0);
  const deposit = data.invoice?.depositAmount ?? Math.round(total * 0.3);
  const remaining = Math.max(0, total - paid);
  const isReceipt = data.type === 'receipt';
  const confirmed = isAgencyConfirmed(data.reservationStatus);
  const proforma = data.type === 'invoice' && !confirmed;
  const stateTone = TONES[kind.state.tone];
  const noticeTone = kind.notice ? TONES[kind.notice.tone] : null;

  const itemRows = isReceipt
    ? `<tr><td class="n">1</td><td><b>دفعة على حساب الحجز</b><small>${escapeHtml(data.packageName || '')}</small></td><td class="amt">${money(paid || total)}</td></tr>`
    : (lines.length ? lines : [{ id: 'base', title: data.packageName || 'برنامج العمرة', detail: '', amount: total }])
        .map((line, i) => `<tr><td class="n">${i + 1}</td><td><b>${escapeHtml(line.title)}</b>${line.detail ? `<small>${escapeHtml(line.detail)}</small>` : ''}</td><td class="amt">${money(line.amount)}</td></tr>`)
        .join('');

  const totals: Array<[string, string, string?]> = isReceipt
    ? [['المبلغ المستلم', money(paid || total), 'grand']]
    : data.type === 'request' || data.type === 'quote'
      ? [['المجموع التقديري', money(total), 'grand']]
      : proforma
        ? [['المجموع', money(total)], ['العربون المطلوب للتأكيد', money(deposit), 'due'], ['المتبقي بعد العربون', money(Math.max(0, total - deposit))]]
        : [['المجموع', money(total), 'grand'], ['المدفوع', money(paid)], ['المتبقي', money(remaining), remaining > 0 ? 'due' : undefined]];

  const tripRows: Array<[string, string]> = [
    ['البرنامج', data.packageName || '—'],
    ['الذهاب', formatShortDate(data.startDate)],
    ['العودة', formatShortDate(data.endDate)],
    ['المدة', data.durationDays ? `${data.durationDays} يوماً` : '—'],
    ['الغرفة', data.roomLabel || data.roomType || '—'],
    ['الطيران', data.airline || '—'],
  ];
  const clientRows: Array<[string, string]> = [
    ['الاسم', data.customerName || '—'],
    ['الهاتف', data.customerPhone || '—'],
    ['البريد', data.customerEmail || '—'],
    ...(data.pilgrimCode ? ([['رمز المعتمر', data.pilgrimCode]] as Array<[string, string]>) : []),
  ];
  const extras = (data.extras || []).map((e) => e.title).filter(Boolean);
  const kv = (rows: Array<[string, string]>) =>
    rows.map(([k, v]) => `<div class="kv"><span>${escapeHtml(k)}</span><b>${escapeHtml(v || '—')}</b></div>`).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(kind.title)} — ${escapeHtml(data.ref)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; }
    body { font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 11.5px; line-height: 1.55; }
    .sheet { position: relative; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm 14mm 12mm; display: flex; flex-direction: column; overflow: hidden; }
    .brandbar { position: absolute; inset: 0 0 auto 0; height: 5px; background: linear-gradient(90deg, #12054a 0 62%, #6ac0ff 62% 100%); }
    .wm { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; z-index: 0; }
    .wm span { transform: rotate(-28deg); font-size: 92px; font-weight: 800; color: rgba(18, 5, 74, 0.045); white-space: nowrap; }
    .sheet > *:not(.wm):not(.brandbar) { position: relative; z-index: 1; }

    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; }
    .org { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .org img { width: 92px; height: 58px; object-fit: cover; object-position: center 46%; }
    .org h1 { margin: 0; font-size: 17px; font-weight: 800; color: #12054a; }
    .org .legal { font-size: 10.5px; color: #64748b; font-weight: 700; letter-spacing: 0.02em; }
    .org .meta { margin-top: 3px; font-size: 10px; color: #475569; }
    .org .meta span + span::before { content: ' · '; color: #cbd5e1; }
    .doc { text-align: left; flex-shrink: 0; }
    .doc .t { font-size: 22px; font-weight: 800; color: #12054a; line-height: 1.15; text-align: right; }
    .doc .en { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; text-align: right; }
    .doc dl { margin: 8px 0 0; display: grid; grid-template-columns: auto auto; gap: 2px 12px; font-size: 10.5px; }
    .doc dt { color: #64748b; font-weight: 700; text-align: right; }
    .doc dd { margin: 0; font-weight: 800; font-family: ui-monospace, Consolas, monospace; direction: ltr; text-align: left; }
    .pill { display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 800; background: ${stateTone.bg}; color: ${stateTone.text}; border: 1px solid ${stateTone.border}; float: right; }

    .notice { margin-top: 14px; display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: ${noticeTone?.bg || '#fff'}; border: 1px solid ${noticeTone?.border || '#e2e8f0'}; color: ${noticeTone?.text || '#0f172a'}; }
    .notice i { flex-shrink: 0; width: 8px; height: 8px; margin-top: 5px; border-radius: 999px; background: ${noticeTone?.solid || '#0f172a'}; }
    .notice b { display: block; font-size: 12px; }
    .notice span { font-size: 10.5px; font-weight: 600; }

    .cards { margin-top: 14px; display: grid; grid-template-columns: 1fr 1.25fr; gap: 12px; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; }
    .card h3 { margin: 0 0 6px; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; color: #64748b; }
    .kv { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; border-bottom: 1px dashed #eef2f7; }
    .kv:last-child { border-bottom: 0; }
    .kv span { color: #64748b; font-weight: 600; white-space: nowrap; }
    .kv b { font-weight: 800; text-align: left; overflow-wrap: anywhere; unicode-bidi: plaintext; }
    .extras { margin-top: 6px; font-size: 10.5px; color: #475569; }

    table.items { width: 100%; margin-top: 14px; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .items th { background: #12054a; color: #fff; font-size: 10.5px; font-weight: 800; padding: 8px 10px; text-align: right; }
    .items th.amt { text-align: left; }
    .items td { padding: 9px 10px; border-top: 1px solid #eef2f7; vertical-align: top; }
    .items td.n { width: 34px; color: #94a3b8; font-weight: 800; }
    .items td small { display: block; color: #64748b; font-size: 10px; margin-top: 1px; }
    .items td.amt { width: 130px; text-align: left; font-weight: 800; white-space: nowrap; }

    .sum { display: flex; justify-content: flex-end; margin-top: 10px; }
    .sum table { width: 280px; border-collapse: collapse; }
    .sum td { padding: 6px 10px; font-size: 11.5px; }
    .sum td:last-child { text-align: left; font-weight: 800; white-space: nowrap; }
    .sum tr.grand td { background: #12054a; color: #fff; font-size: 13px; font-weight: 800; }
    .sum tr.grand td:first-child { border-radius: 0 8px 8px 0; }
    .sum tr.grand td:last-child { border-radius: 8px 0 0 8px; }
    .sum tr.due td { background: #fffbeb; color: #92400e; font-weight: 800; }
    .sum tr + tr td { border-top: 1px solid #f1f5f9; }

    .confirm { margin-top: 12px; font-size: 10.5px; color: #475569; }
    .confirm b { color: #065f46; }

    .bottom { margin-top: auto; padding-top: 18px; display: grid; grid-template-columns: auto 1fr 1fr; gap: 16px; align-items: end; }
    .verify { display: flex; gap: 10px; align-items: center; }
    .verify img { width: 84px; height: 84px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 3px; background: #fff; }
    .verify div { font-size: 9.5px; color: #64748b; line-height: 1.6; }
    .verify code { display: block; font-size: 11px; font-weight: 800; color: #12054a; letter-spacing: 0.08em; direction: ltr; text-align: right; }
    .verify .url { direction: ltr; text-align: right; font-size: 8.5px; color: #94a3b8; word-break: break-all; }
    .sign { height: 64px; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 6px 10px; font-size: 10px; color: #64748b; font-weight: 700; }
    .foot { margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }

    @media screen { body { background: #fff; } }
    @media print { .sheet { width: auto; min-height: 297mm; } }
  </style>
</head>
<body>
  <article class="sheet">
    <div class="brandbar"></div>
    ${kind.watermark ? `<div class="wm"><span>${escapeHtml(kind.watermark)}</span></div>` : ''}

    <header class="top">
      <div class="org">
        ${logoSrc ? `<img src="${logoSrc}" alt="" />` : ''}
        <div>
          <h1>${escapeHtml(agency.name)}</h1>
          <div class="legal">${escapeHtml(agency.legal)}</div>
          ${agency.lines.length || agency.contact.length ? `<div class="meta">${[...agency.lines, ...agency.contact].map((v) => `<span>${escapeHtml(v)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="doc">
        <div class="t">${escapeHtml(kind.title)}</div>
        <div class="en">${escapeHtml(kind.english)}</div>
        <dl>
          <dt>الرقم</dt><dd>${escapeHtml(data.ref)}</dd>
          <dt>التاريخ</dt><dd>${escapeHtml(formatShortDate(data.issuedAt))}</dd>
        </dl>
        <span class="pill">${escapeHtml(kind.state.label)}</span>
      </div>
    </header>

    ${kind.notice ? `<div class="notice"><i></i><div><b>${escapeHtml(kind.notice.title)}</b><span>${escapeHtml(kind.notice.text)}</span></div></div>` : ''}

    <section class="cards">
      <div class="card"><h3>${isReceipt ? 'الدافع' : 'العميل'}</h3>${kv(clientRows)}</div>
      <div class="card"><h3>الرحلة</h3>${kv(tripRows)}${extras.length && !isReceipt ? `<div class="extras">الإضافات: ${escapeHtml(extras.join(' · '))}</div>` : ''}</div>
    </section>

    <table class="items">
      <thead><tr><th>#</th><th>البيان</th><th class="amt">المبلغ</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="sum"><table>${totals.map(([k, v, cls]) => `<tr${cls ? ` class="${cls}"` : ''}><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</table></div>

    ${(data.type === 'confirmation' || (data.type === 'invoice' && confirmed)) && data.agencyConfirmedAt
      ? `<p class="confirm">أكّدت الوكالة هذا الحجز يوم <b>${escapeHtml(formatShortDate(data.agencyConfirmedAt))}</b>${data.agencyConfirmedBy ? ` — ${escapeHtml(data.agencyConfirmedBy)}` : ''}.</p>`
      : ''}

    <section class="bottom">
      <div class="verify">
        <img src="${qrSrc}" alt="" />
        <div>
          تحقّق من صحة الوثيقة
          ${data.verifyCode ? `<code>${escapeHtml(data.verifyCode)}</code>` : ''}
          <div class="url">${escapeHtml(displayTrackUrl(trackUrl))}</div>
        </div>
      </div>
      <div class="sign">${data.type === 'request' ? 'توقيع طالب الحجز' : isReceipt ? 'توقيع المستلم' : 'توقيع العميل'}</div>
      <div class="sign">ختم وتوقيع الوكالة</div>
    </section>

    <footer class="foot">
      <span>${escapeHtml(agency.name)} — ${escapeHtml(agency.legal)}</span>
      <span>${escapeHtml(kind.title)} · ${escapeHtml(data.ref)}</span>
    </footer>
  </article>
</body>
</html>`;
}

export function renderBookingDocumentHtml(data: BookingDocumentPayload): string {
  return renderSimpleDocument(data);
}

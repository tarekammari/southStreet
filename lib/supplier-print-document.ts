import { fmtAmount } from '@/components/accountant/money';
import { supplierCategoryLabel } from '@/lib/finance-categories';

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Stable LTR stamp for print letterheads (avoids ar-DZ bidi glitches in meta blocks). */
function formatPrintDateTime(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function acct(n: number): string {
  const v = Number(n) || 0;
  const body = fmtAmount(Math.abs(v));
  return v < 0 ? `(${body})` : body;
}

type Orient = 'portrait' | 'landscape';
type Sheet = { orient: Orient; body: string };

const SETTLEMENT: Record<string, string> = {
  NO_INVOICES: 'بدون فواتير',
  PAID_FULL: 'خالص',
  OVERDUE: 'متأخر',
  DUE_SOON: 'يستحق قريباً',
  OPEN: 'مفتوح',
};

const METHOD: Record<string, string> = {
  CASH: 'نقد',
  CCP: 'CCP',
  BANK_TRANSFER: 'تحويل بنكي',
  CHECK: 'شيك',
  OTHER: 'أخرى',
};

export type SupplierBookRow = {
  name_ar: string;
  code: string;
  category?: string | null;
  total_invoiced: number;
  total_paid: number;
  total_remaining: number;
  settlement: string;
};

export type SupplierInvoicePrint = {
  invoice_no: string;
  invoice_date: string;
  due_date: string;
  amount_ht: number;
  discount: number;
  tax_amount: number;
  amount: number;
  paid_amount: number;
  remaining: number;
  status: string;
};

export type SupplierPaymentPrint = {
  payment_date: string;
  method: string;
  invoice_no: string;
  amount: number;
  note: string;
};

export type SupplierStatementPrint = {
  date: string;
  ref: string;
  label: string;
  debit: number;
  credit: number;
  balance: number;
};

const PRINT_STYLES = `
  @page sheet-portrait { size: A4 portrait; margin: 10mm 12mm; }
  @page sheet-landscape { size: A4 landscape; margin: 8mm 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif;
    font-size: 11px; line-height: 1.4; color: #1c1917;
  }
  .print-page {
    background: #fff; display: flex; flex-direction: column;
    page-break-after: always; overflow: hidden;
  }
  .print-page:last-child { page-break-after: auto; }
  .print-page.orient-portrait { page: sheet-portrait; width: 210mm; height: 297mm; }
  .print-page.orient-landscape { page: sheet-landscape; width: 297mm; height: 210mm; }
  .page-inner { flex: 1; padding: 10mm 12mm 4mm; overflow: hidden; }
  .letterhead {
    display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;
    padding-bottom: 8px; border-bottom: 2.5px solid #a16207; margin-bottom: 8px;
  }
  .letterhead-en { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; color: #a16207; }
  .letterhead-ar { font-size: 13px; font-weight: 800; margin-top: 1px; }
  .letterhead-meta {
    text-align: left; direction: ltr; font-size: 9px; color: #78716c;
    font-variant-numeric: tabular-nums; line-height: 1.45;
  }
  .letterhead-period { font-weight: 700; color: #57534e; unicode-bidi: isolate; }
  .letterhead-printed { unicode-bidi: isolate; white-space: nowrap; }
  .doc-sub-period { unicode-bidi: isolate; direction: ltr; display: inline-block; }
  .doc-title { font-size: 16px; font-weight: 800; margin: 0 0 2px; }
  .doc-sub { font-size: 10px; color: #78716c; margin: 0 0 8px; }
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
  .kpi { border: 1px solid #e7e5e4; border-radius: 6px; padding: 7px 8px; background: #fafaf9; }
  .kpi-label { font-size: 8.5px; font-weight: 700; color: #78716c; }
  .kpi-value {
    margin-top: 2px; font-size: 12px; font-weight: 800;
    font-variant-numeric: tabular-nums; direction: ltr; text-align: right;
    font-family: 'Segoe UI', Tahoma, sans-serif;
  }
  .neg { color: #9f1239; }
  .section-title { font-size: 12px; font-weight: 800; margin: 8px 0 4px; }
  .unit-note { font-size: 8.5px; color: #a8a29e; margin: 0 0 4px; text-align: left; direction: ltr; }
  table.fin { width: 100%; border-collapse: collapse; font-size: 8.5px; font-variant-numeric: tabular-nums; }
  table.fin { direction: rtl; }
  table.fin th {
    background: #292524; color: #fafaf9; font-weight: 700; text-align: right;
    padding: 4px 6px; border: 1px solid #292524;
  }
  table.fin th.num, table.fin td.num {
    text-align: right; direction: ltr; font-family: 'Segoe UI', Tahoma, sans-serif;
    font-weight: 600; white-space: nowrap;
  }
  table.fin td {
    padding: 3px 6px; border: 1px solid #e7e5e4; vertical-align: middle;
    text-align: right;
  }
  table.fin tr.total td { font-weight: 800; background: #f5f5f4; border-top: 1.5px solid #292524; }
  .page-foot {
    padding: 3px 12mm 7mm; display: flex; justify-content: space-between;
    font-size: 8.5px; color: #a8a29e; border-top: 1px solid #e7e5e4;
  }
  @media print {
    .print-page.orient-portrait, .print-page.orient-landscape { width: auto; height: auto; overflow: visible; }
  }
`;

function numCell(n: number): string {
  return `<td class="num${n < 0 ? ' neg' : ''}">${escapeHtml(acct(n))}</td>`;
}

function letterhead(printedAt: string, periodLine: string, scopeLine?: string): string {
  return `<header class="letterhead">
    <div>
      <div class="letterhead-en">SOUTH STREET AGENCY</div>
      <div class="letterhead-ar">وكالة ساوث ستريت — الموردون</div>
    </div>
    <div class="letterhead-meta">
      ${scopeLine ? `<div>${escapeHtml(scopeLine)}</div>` : ''}
      <div class="letterhead-period">${escapeHtml(periodLine)}</div>
      <div class="letterhead-printed">${escapeHtml(printedAt)}</div>
    </div>
  </header>`;
}

function chunks<T>(rows: T[], size: number): T[][] {
  if (!rows.length) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function wrapSheets(title: string, sheets: Sheet[], lh: string): string {
  const total = sheets.length;
  const body = sheets
    .map(
      (sheet, i) => `<section class="print-page orient-${sheet.orient}" data-page="${i + 1}" data-orient="${sheet.orient}">
      <div class="page-inner">${lh}${sheet.body}</div>
      <footer class="page-foot">
        <span>${escapeHtml(title)} · ${sheet.orient === 'landscape' ? 'A4 أفقي' : 'A4 عمودي'}</span>
        <span>صفحة ${i + 1} من ${total}</span>
      </footer>
    </section>`
    )
    .join('');
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;800&display=swap" rel="stylesheet" />
  <style>${PRINT_STYLES}</style>
</head>
<body>${body}</body>
</html>`;
}

function kpis(cells: { label: string; value: number }[]): string {
  return `<div class="kpi-row">${cells
    .map(
      (c) =>
        `<div class="kpi"><div class="kpi-label">${escapeHtml(c.label)}</div><div class="kpi-value${c.value < 0 ? ' neg' : ''}">${escapeHtml(acct(c.value))}</div></div>`
    )
    .join('')}</div>`;
}

export function buildSupplierBookHtml(input: {
  title: string;
  from: string;
  to: string;
  rows: SupplierBookRow[];
}): string {
  const printedAt = formatPrintDateTime();
  const periodLine = `${input.from} → ${input.to}`;
  const invoiced = input.rows.reduce((s, r) => s + r.total_invoiced, 0);
  const paid = input.rows.reduce((s, r) => s + r.total_paid, 0);
  const remaining = input.rows.reduce((s, r) => s + r.total_remaining, 0);
  const pages = chunks(input.rows, 18);
  const sheets: Sheet[] = pages.map((page, index) => {
    const body = page
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.name_ar)}</td><td>${escapeHtml(r.code || '—')}</td><td>${escapeHtml(supplierCategoryLabel(r.category))}</td>${numCell(r.total_invoiced)}${numCell(r.total_paid)}${numCell(r.total_remaining)}<td>${escapeHtml(SETTLEMENT[r.settlement] || r.settlement)}</td></tr>`
      )
      .join('');
    const head =
      index === 0
        ? `<h1 class="doc-title">${escapeHtml(input.title)}</h1>
           <p class="doc-sub">وضعية الموردين · ${input.rows.length} مورد · الفترة <span class="doc-sub-period">${escapeHtml(periodLine)}</span></p>
           ${kpis([
             { label: 'المفوتر (دج)', value: invoiced },
             { label: 'المدفوع (دج)', value: paid },
             { label: 'المتبقي (دج)', value: remaining },
             { label: 'عدد الموردين', value: input.rows.length },
           ])}`
        : `<h1 class="doc-title">${escapeHtml(input.title)}</h1><p class="doc-sub">تابع الدليل</p>`;
    return {
      orient: 'portrait' as const,
      body: `${head}
        <p class="unit-note">DZD</p>
        <table class="fin">
          <thead><tr><th>المورد</th><th>الرمز</th><th>التصنيف</th><th class="num">مفوتر</th><th class="num">مدفوع</th><th class="num">المتبقي</th><th>الحالة</th></tr></thead>
          <tbody>
            ${body || '<tr><td colspan="7">لا موردين</td></tr>'}
            ${index === pages.length - 1 ? `<tr class="total"><td colspan="3">المجموع</td>${numCell(invoiced)}${numCell(paid)}${numCell(remaining)}<td></td></tr>` : ''}
          </tbody>
        </table>`,
    };
  });
  return wrapSheets(input.title, sheets, letterhead(printedAt, periodLine));
}

export function buildSupplierCardHtml(input: {
  name_ar: string;
  code: string;
  category?: string | null;
  scf_code?: string | null;
  contact?: string | null;
  payment_terms_days?: number;
  invoices: SupplierInvoicePrint[];
  payments: SupplierPaymentPrint[];
  lines: SupplierStatementPrint[];
}): string {
  const printedAt = formatPrintDateTime();
  const invoices = [...input.invoices].sort(
    (a, b) => a.invoice_date.localeCompare(b.invoice_date) || a.invoice_no.localeCompare(b.invoice_no)
  );
  const payments = [...input.payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date));
  const invoiced = invoices.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const paid = invoices.reduce((s, r) => s + (Number(r.paid_amount) || 0), 0);
  const remaining = invoices.reduce((s, r) => s + (Number(r.remaining) || 0), 0);
  const title = input.name_ar || 'مورد';
  const sheets: Sheet[] = [];

  const invoicePages = chunks(invoices, 12);
  invoicePages.forEach((page, index) => {
    const rows = page
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.invoice_no || '—')}</td><td>${escapeHtml(r.invoice_date || '—')}</td><td>${escapeHtml(r.due_date || '—')}</td>${numCell(r.amount_ht)}${numCell(r.discount)}${numCell(r.tax_amount)}${numCell(r.amount)}${numCell(r.paid_amount)}${numCell(r.remaining)}</tr>`
      )
      .join('');
    sheets.push({
      orient: 'landscape',
      body: `${
        index === 0
          ? `<h1 class="doc-title">${escapeHtml(title)}</h1>
             <p class="doc-sub">${escapeHtml(input.code || '—')} · ${escapeHtml(supplierCategoryLabel(input.category))} · حساب ${escapeHtml(input.scf_code || '—')} · أجل ${Number(input.payment_terms_days) || 0} يوم${input.contact ? ` · ${escapeHtml(input.contact)}` : ''}</p>
             ${kpis([
               { label: 'المفوتر (دج)', value: invoiced },
               { label: 'المدفوع (دج)', value: paid },
               { label: 'المتبقي (دج)', value: remaining },
               { label: 'عدد الفواتير', value: invoices.length },
             ])}`
          : `<h1 class="doc-title">${escapeHtml(title)}</h1><p class="doc-sub">تابع الفواتير</p>`
      }
        <h2 class="section-title">الفواتير</h2>
        <p class="unit-note">DZD</p>
        <table class="fin">
          <thead><tr><th>الرقم</th><th>التاريخ</th><th>الاستحقاق</th><th class="num">خارج الرسم</th><th class="num">التخفيض</th><th class="num">الرسم</th><th class="num">شامل الرسم</th><th class="num">المدفوع</th><th class="num">المتبقي</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="9">لا فواتير</td></tr>'}</tbody>
        </table>`,
    });
  });

  const payPages = chunks(payments, 16);
  if (payments.length) {
    payPages.forEach((page, index) => {
      const rows = page
        .map(
          (p) =>
            `<tr><td>${escapeHtml(p.payment_date || '—')}</td><td>${escapeHtml(METHOD[p.method] || p.method || '—')}</td><td>${escapeHtml(p.invoice_no || 'على الحساب')}</td><td>${escapeHtml(p.note || '—')}</td>${numCell(p.amount)}</tr>`
        )
        .join('');
      sheets.push({
        orient: 'portrait',
        body: `<h1 class="doc-title">${escapeHtml(title)}</h1>
          <h2 class="section-title">الدفعات${index ? ' — تابع' : ''}</h2>
          <p class="unit-note">DZD</p>
          <table class="fin">
            <thead><tr><th>التاريخ</th><th>الطريقة</th><th>الفاتورة</th><th>البيان</th><th class="num">المبلغ (دج)</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`,
      });
    });
  }

  chunks(input.lines, 22).forEach((page, index) => {
    const rows = page
      .map(
        (l) =>
          `<tr><td>${escapeHtml(l.date || '—')}</td><td>${escapeHtml(l.ref || '—')}</td><td>${escapeHtml(l.label || '—')}</td>${numCell(l.debit)}${numCell(l.credit)}${numCell(l.balance)}</tr>`
      )
      .join('');
    const lastBalance = input.lines.length ? input.lines[input.lines.length - 1].balance : 0;
    sheets.push({
      orient: 'portrait',
      body: `<h1 class="doc-title">${escapeHtml(title)}</h1>
        <h2 class="section-title">كشف الحساب${index ? ' — تابع' : ''}</h2>
        <p class="unit-note">DZD</p>
        <table class="fin">
          <thead><tr><th>التاريخ</th><th>المرجع</th><th>البيان</th><th class="num">مدين</th><th class="num">دائن</th><th class="num">الرصيد</th></tr></thead>
          <tbody>
            ${rows || '<tr><td colspan="6">لا حركة</td></tr>'}
            ${index === Math.ceil(input.lines.length / 22) - 1 || !input.lines.length ? `<tr class="total"><td colspan="5">الرصيد</td>${numCell(lastBalance)}</tr>` : ''}
          </tbody>
        </table>`,
    });
  });

  const scope = input.code ? `${input.code} · كشف حساب` : 'كشف حساب';
  return wrapSheets(`كشف ${title}`, sheets, letterhead(printedAt, scope, title));
}

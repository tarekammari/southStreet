import { fmtAmount } from '@/components/accountant/money';

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function acct(n: number): string {
  const v = Number(n) || 0;
  const body = fmtAmount(Math.abs(v));
  return v < 0 ? `(${body})` : body;
}

const MONTHS = [
  'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
  'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function monthLabel(m: number): string {
  return MONTHS[m - 1] || String(m);
}

type Orient = 'portrait' | 'landscape';
type Sheet = { orient: Orient; body: string };

export type PayrollStaffPrint = {
  staff_name: string;
  total: number;
  paid_total: number;
  pending_total: number;
  months: number;
};

export type PayrollLinePrint = {
  period_year: number;
  period_month: number;
  amount: number;
  status: string;
  paid_at: string;
  note: string;
  kind: string;
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
  .letterhead-meta { text-align: left; direction: ltr; font-size: 9px; color: #78716c; font-variant-numeric: tabular-nums; }
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
  .section-title { font-size: 12px; font-weight: 800; margin: 8px 0 4px; }
  .unit-note { font-size: 8.5px; color: #a8a29e; margin: 0 0 4px; text-align: left; direction: ltr; }
  table.fin { width: 100%; border-collapse: collapse; font-size: 8.5px; font-variant-numeric: tabular-nums; }
  table.fin th {
    background: #292524; color: #fafaf9; font-weight: 700; text-align: right;
    padding: 4px 6px; border: 1px solid #292524;
  }
  table.fin th.num, table.fin td.num {
    text-align: right; direction: ltr; font-family: 'Segoe UI', Tahoma, sans-serif;
    font-weight: 600; white-space: nowrap;
  }
  table.fin th.num { text-align: left; }
  table.fin td { padding: 3px 6px; border: 1px solid #e7e5e4; vertical-align: middle; }
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
  return `<td class="num">${escapeHtml(acct(n))}</td>`;
}

function letterhead(printedAt: string, meta: string): string {
  return `<header class="letterhead">
    <div>
      <div class="letterhead-en">SOUTH STREET AGENCY</div>
      <div class="letterhead-ar">وكالة ساوث ستريت — الرواتب</div>
    </div>
    <div class="letterhead-meta"><div>${escapeHtml(meta)}</div><div>${escapeHtml(printedAt)}</div></div>
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
        `<div class="kpi"><div class="kpi-label">${escapeHtml(c.label)}</div><div class="kpi-value">${escapeHtml(acct(c.value))}</div></div>`
    )
    .join('')}</div>`;
}

function kindLabel(kind: string): string {
  return String(kind || '').toLowerCase() === 'advance' ? 'تسبيق' : 'راتب';
}

function statusLabel(status: string): string {
  return String(status || '').toUpperCase() === 'PAID' ? 'مصروف' : 'معلّق';
}

export function buildPayrollBookHtml(input: {
  period: string;
  staff: PayrollStaffPrint[];
  total: number;
  paid_total: number;
  pending_total: number;
}): string {
  const printedAt = new Date().toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' });
  const pages = chunks(input.staff, 18);
  const sheets: Sheet[] = pages.map((page, index) => {
    const body = page
      .map(
        (s) =>
          `<tr><td>${escapeHtml(s.staff_name)}</td><td class="num">${s.months}</td>${numCell(s.total)}${numCell(s.paid_total)}${numCell(s.pending_total)}</tr>`
      )
      .join('');
    const head =
      index === 0
        ? `<h1 class="doc-title">الرواتب</h1>
           <p class="doc-sub">${escapeHtml(input.period)} · ${input.staff.length} موظف</p>
           ${kpis([
             { label: 'الإجمالي (دج)', value: input.total },
             { label: 'المصروف (دج)', value: input.paid_total },
             { label: 'المعلّق (دج)', value: input.pending_total },
             { label: 'عدد الموظفين', value: input.staff.length },
           ])}`
        : `<h1 class="doc-title">الرواتب</h1><p class="doc-sub">تابع الكشف · ${escapeHtml(input.period)}</p>`;
    return {
      orient: 'portrait' as const,
      body: `${head}
        <p class="unit-note">DZD</p>
        <table class="fin">
          <thead><tr><th>الموظف</th><th class="num">الأشهر</th><th class="num">الإجمالي</th><th class="num">المصروف</th><th class="num">المعلّق</th></tr></thead>
          <tbody>
            ${body || '<tr><td colspan="5">لا قيود رواتب في هذه الفترة</td></tr>'}
            ${index === pages.length - 1 ? `<tr class="total"><td colspan="2">المجموع</td>${numCell(input.total)}${numCell(input.paid_total)}${numCell(input.pending_total)}</tr>` : ''}
          </tbody>
        </table>`,
    };
  });
  return wrapSheets('الرواتب', sheets, letterhead(printedAt, input.period));
}

export function buildStaffPayrollHtml(input: {
  period: string;
  staff_name: string;
  total: number;
  paid_total: number;
  pending_total: number;
  lines: PayrollLinePrint[];
}): string {
  const printedAt = new Date().toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' });
  const pages = chunks(input.lines, 18);
  const sheets: Sheet[] = pages.map((page, index) => {
    const rows = page
      .map(
        (l) =>
          `<tr><td>${escapeHtml(monthLabel(l.period_month))} ${l.period_year}</td><td>${escapeHtml(kindLabel(l.kind))}</td>${numCell(l.amount)}<td>${escapeHtml(statusLabel(l.status))}</td><td>${escapeHtml(l.paid_at || '—')}</td><td>${escapeHtml(l.note || '—')}</td></tr>`
      )
      .join('');
    const head =
      index === 0
        ? `<h1 class="doc-title">${escapeHtml(input.staff_name)}</h1>
           <p class="doc-sub">كشف راتب · ${escapeHtml(input.period)}</p>
           ${kpis([
             { label: 'الإجمالي (دج)', value: input.total },
             { label: 'المصروف (دج)', value: input.paid_total },
             { label: 'المعلّق (دج)', value: input.pending_total },
             { label: 'عدد القيود', value: input.lines.length },
           ])}`
        : `<h1 class="doc-title">${escapeHtml(input.staff_name)}</h1><p class="doc-sub">تابع الكشف</p>`;
    return {
      orient: 'portrait' as const,
      body: `${head}
        <h2 class="section-title">القيود</h2>
        <p class="unit-note">DZD</p>
        <table class="fin">
          <thead><tr><th>الفترة</th><th>النوع</th><th class="num">المبلغ (دج)</th><th>الحالة</th><th>تاريخ الصرف</th><th>البيان</th></tr></thead>
          <tbody>
            ${rows || '<tr><td colspan="6">لا قيود</td></tr>'}
            ${index === pages.length - 1 ? `<tr class="total"><td colspan="2">المجموع</td>${numCell(input.total)}<td colspan="3"></td></tr>` : ''}
          </tbody>
        </table>`,
    };
  });
  return wrapSheets(`راتب ${input.staff_name}`, sheets, letterhead(printedAt, input.staff_name));
}

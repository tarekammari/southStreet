import { fmtAmount } from '@/components/accountant/money';
import { treasuryKindLabel } from '@/lib/finance-categories';
import { buildOfficialCashFlow } from '@/lib/scf-cash-flow-statement';
import { buildOfficialResultat } from '@/lib/scf-result-statement';
import {
  BILAN_GROUP_LABELS,
  BILAN_SUBTOTAL_LABELS,
  type BilanGroupId,
  type ScfBilanLine,
} from '@/lib/scf-balance-sheet';

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Financial-statement amount: grouped, two decimals, negatives in parentheses. */
function acct(n: number): string {
  const v = Number(n) || 0;
  const body = fmtAmount(Math.abs(v));
  return v < 0 ? `(${body})` : body;
}

type Orient = 'portrait' | 'landscape';
type Sheet = { orient: Orient; body: string };

export type RecapPrintInput = {
  from: string;
  to: string;
  income: number;
  spending: number;
  net: number;
  statement?: {
    products?: { amount: number; scf_code?: string }[];
    charges?: { amount: number; scf_code?: string }[];
    total_products?: number;
    total_charges?: number;
    result?: number;
  };
  balance_sheet?: {
    actif: ScfBilanLine[];
    passif: ScfBilanLine[];
    total_actif: number;
    total_passif: number;
    subtotals?: Partial<Record<BilanGroupId, number>>;
  };
  treasury?: {
    accounts?: {
      name_ar: string;
      kind: string;
      bank_name?: string;
      period_closing?: number;
      balance: number;
    }[];
    period_opening?: number;
    period_closing?: number;
    total: number;
    cash_flow?: {
      lines: { id: string; amount: number }[];
    };
  };
};

const PRINT_STYLES = `
  @page sheet-portrait { size: A4 portrait; margin: 10mm 12mm; }
  @page sheet-landscape { size: A4 landscape; margin: 8mm 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    color: #1c1917;
  }
  .print-page {
    background: #fff;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    overflow: hidden;
  }
  .print-page:last-child { page-break-after: auto; }
  .print-page.orient-portrait { page: sheet-portrait; width: 210mm; height: 297mm; }
  .print-page.orient-landscape { page: sheet-landscape; width: 297mm; height: 210mm; }
  .page-inner { flex: 1; padding: 10mm 12mm 4mm; overflow: hidden; }
  .letterhead {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    padding-bottom: 8px;
    border-bottom: 2.5px solid #a16207;
    margin-bottom: 8px;
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
    margin-top: 2px;
    font-size: 12px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    direction: ltr;
    text-align: right;
    font-family: 'Segoe UI', Tahoma, sans-serif;
  }
  .neg { color: #9f1239; }
  .section-title { font-size: 12px; font-weight: 800; margin: 8px 0 2px; }
  .section-note { font-size: 9px; color: #a8a29e; margin: 0 0 6px; }
  .unit-note { font-size: 8.5px; color: #a8a29e; margin: 0 0 4px; text-align: left; direction: ltr; }
  table.fin { width: 100%; border-collapse: collapse; font-size: 8.5px; font-variant-numeric: tabular-nums; }
  table.fin th {
    background: #292524; color: #fafaf9; font-weight: 700; text-align: right;
    padding: 4px 6px; border: 1px solid #292524;
  }
  table.fin th.num { text-align: left; direction: ltr; }
  table.fin td { padding: 3px 6px; border: 1px solid #e7e5e4; vertical-align: middle; }
  table.fin td.num {
    text-align: right; direction: ltr; font-family: 'Segoe UI', Tahoma, sans-serif;
    font-weight: 600; white-space: nowrap; width: 1%;
  }
  table.fin td.code { font-size: 8px; color: #57534e; white-space: normal; width: 22%; }
  table.fin tr.group td { background: #44403c; color: #fafaf9; font-weight: 800; }
  table.fin tr.subtotal td, table.fin tr.total td {
    font-weight: 800; background: #f5f5f4 !important; border-top: 1.5px solid #292524;
  }
  .page-foot {
    padding: 3px 12mm 7mm;
    display: flex; justify-content: space-between;
    font-size: 8.5px; color: #a8a29e; border-top: 1px solid #e7e5e4;
  }
  @media print {
    .print-page.orient-portrait, .print-page.orient-landscape { width: auto; height: auto; overflow: visible; }
  }
`;

function letterhead(printedAt: string, from: string, to: string): string {
  return `<header class="letterhead">
    <div>
      <div class="letterhead-en">SOUTH STREET AGENCY</div>
      <div class="letterhead-ar">وكالة ساوث ستريت — القوائم المالية</div>
    </div>
    <div class="letterhead-meta">
      <div>${escapeHtml(from)} → ${escapeHtml(to)}</div>
      <div>${escapeHtml(printedAt)}</div>
    </div>
  </header>`;
}

function numCell(n: number): string {
  return `<td class="num${n < 0 ? ' neg' : ''}">${escapeHtml(acct(n))}</td>`;
}

function summarySheet(data: RecapPrintInput): Sheet {
  const treasury = data.treasury?.period_closing ?? data.treasury?.total ?? 0;
  const accounts = data.treasury?.accounts || [];
  const rows = accounts
    .map((a) => {
      const closing = a.period_closing ?? a.balance ?? 0;
      const kind = [treasuryKindLabel(a.kind), a.bank_name].filter(Boolean).join(' · ');
      return `<tr><td>${escapeHtml(a.name_ar || 'حساب')}</td><td class="code">${escapeHtml(kind)}</td>${numCell(closing)}</tr>`;
    })
    .join('');
  return {
    orient: 'portrait',
    body: `
      <h1 class="doc-title">ملخص الفترة</h1>
      <p class="doc-sub">SCF — حساب النتائج، الميزانية، جدول سيولة الخزينة</p>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">المداخيل (دج)</div><div class="kpi-value">${escapeHtml(acct(data.income))}</div></div>
        <div class="kpi"><div class="kpi-label">الأعباء (دج)</div><div class="kpi-value">${escapeHtml(acct(data.spending))}</div></div>
        <div class="kpi"><div class="kpi-label">النتيجة (دج)</div><div class="kpi-value${data.net < 0 ? ' neg' : ''}">${escapeHtml(acct(data.net))}</div></div>
        <div class="kpi"><div class="kpi-label">رصيد الخزينة (دج)</div><div class="kpi-value${treasury < 0 ? ' neg' : ''}">${escapeHtml(acct(treasury))}</div></div>
      </div>
      <h2 class="section-title">حسابات الخزينة</h2>
      <p class="section-note">رصيد نهاية الفترة لكل حساب</p>
      <p class="unit-note">DZD</p>
      <table class="fin">
        <thead><tr><th>الحساب</th><th>النوع</th><th class="num">الرصيد (دج)</th></tr></thead>
        <tbody>
          ${rows || '<tr><td colspan="3">لا حساب مسجّل</td></tr>'}
          <tr class="total"><td colspan="2">رصيد الخزينة</td>${numCell(treasury)}</tr>
        </tbody>
      </table>`,
  };
}

function resultatSheet(data: RecapPrintInput): Sheet {
  const rows = buildOfficialResultat({
    products: data.statement?.products,
    charges: data.statement?.charges,
    total_products: data.statement?.total_products,
    total_charges: data.statement?.total_charges,
    result: data.statement?.result,
  });
  const body = rows
    .map((row) => {
      const cls = row.kind === 'total' ? ' class="total"' : '';
      return `<tr${cls}><td>${escapeHtml(row.label)}</td><td class="code">${escapeHtml(row.accounts || '—')}</td>${numCell(row.amount)}</tr>`;
    })
    .join('');
  return {
    orient: 'portrait',
    body: `
      <h1 class="doc-title">حساب النتائج</h1>
      <p class="doc-sub">حسب الطبيعة · الجريدة الرسمية 19 (25 مارس 2009) · ${escapeHtml(data.from)} → ${escapeHtml(data.to)}</p>
      <p class="unit-note">DZD</p>
      <table class="fin">
        <thead><tr><th>البند</th><th>الحسابات</th><th class="num">المبلغ (دج)</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`,
  };
}

function bilanSide(title: string, lines: ScfBilanLine[], groups: BilanGroupId[], subtotals: RecapPrintInput['balance_sheet'], total: number, totalLabel: string): string {
  const chunks = groups
    .map((group) => {
      const rows = lines.filter((r) => r.group === group);
      if (!rows.length) return '';
      const valued = rows.filter((r) => !r.header);
      const sub = subtotals?.subtotals?.[group] ?? valued.reduce((s, r) => s + r.amount, 0);
      const inner = rows
        .map((row) =>
          row.header
            ? `<tr class="subtotal"><td colspan="4">${escapeHtml(row.label)}</td></tr>`
            : `<tr><td>${escapeHtml(row.label)}</td><td class="code">${escapeHtml(row.scf_code || '—')}</td><td class="code">${escapeHtml(row.amort_accounts || '—')}</td>${numCell(row.amount)}</tr>`
        )
        .join('');
      return `<tr class="group"><td colspan="4">${escapeHtml(BILAN_GROUP_LABELS[group])}</td></tr>${inner}
        <tr class="subtotal"><td colspan="3">${escapeHtml(BILAN_SUBTOTAL_LABELS[group])}</td>${numCell(sub)}</tr>`;
    })
    .join('');
  return `
    <h1 class="doc-title">${escapeHtml(title)}</h1>
    <p class="doc-sub">الميزانية · الجريدة الرسمية 19 (25 مارس 2009)</p>
    <p class="unit-note">DZD</p>
    <table class="fin">
      <thead><tr><th>البند</th><th>الحسابات</th><th>الاهتلاك / الملاحظة</th><th class="num">المبلغ (دج)</th></tr></thead>
      <tbody>${chunks}<tr class="total"><td colspan="3">${escapeHtml(totalLabel)}</td>${numCell(total)}</tr></tbody>
    </table>`;
}

function cashFlowSheet(data: RecapPrintInput): Sheet {
  const byId = new Map((data.treasury?.cash_flow?.lines || []).map((l) => [l.id, l.amount]));
  const rows = buildOfficialCashFlow({
    clientIn: byId.get('client_in') || 0,
    supplierOut: byId.get('supplier_out') || 0,
    payrollOut: byId.get('payroll_out') || 0,
    serviceOut: byId.get('service_out') || 0,
    otherOut: byId.get('other_out') || 0,
    opening: data.treasury?.period_opening ?? 0,
    closing: data.treasury?.period_closing ?? data.treasury?.total ?? 0,
  });
  const body = rows
    .map((row) => {
      if (row.kind === 'section') return `<tr class="group"><td colspan="3">${escapeHtml(row.label)}</td></tr>`;
      const amount = row.amount ?? 0;
      const cls = row.kind === 'total' ? ' class="total"' : '';
      return `<tr${cls}><td>${escapeHtml(row.label)}</td>${numCell(amount)}<td class="num">—</td></tr>`;
    })
    .join('');
  return {
    orient: 'portrait',
    body: `
      <h1 class="doc-title">جدول سيولة الخزينة</h1>
      <p class="doc-sub">الطريقة المباشرة · ${escapeHtml(data.from)} → ${escapeHtml(data.to)}</p>
      <p class="unit-note">DZD</p>
      <table class="fin">
        <thead><tr><th>البند</th><th class="num">السنة المالية N (دج)</th><th class="num">السنة المالية N−1</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`,
  };
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

export function buildRecapPrintHtml(data: RecapPrintInput): string {
  const printedAt = new Date().toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' });
  const lh = letterhead(printedAt, data.from, data.to);
  const bs = data.balance_sheet;
  const sheets: Sheet[] = [
    summarySheet(data),
    resultatSheet(data),
    {
      orient: 'landscape',
      body: bilanSide('الميزانية — الأصول', bs?.actif || [], ['actif_immobilise', 'actif_circulant'], bs, bs?.total_actif ?? 0, 'مجموع الأصول'),
    },
    {
      orient: 'landscape',
      body: bilanSide('الميزانية — الخصوم', bs?.passif || [], ['capitaux_propres', 'passif_non_courant', 'passif_circulant'], bs, bs?.total_passif ?? 0, 'مجموع الخصوم'),
    },
    cashFlowSheet(data),
  ];
  return wrapSheets('القوائم المالية', sheets, lh);
}

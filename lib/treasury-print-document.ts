import { TREASURY_IFRS } from '@/lib/accountant-sections';
import { TREASURY_KINDS, treasuryKindLabel } from '@/lib/finance-categories';
import { treasuryOverview, type TreasuryAccountMove, type TreasuryFlowMove } from '@/lib/finance';
import { fmtAmount, fmtCount, payMethodLabel } from '@/components/accountant/money';

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Financial-statement amount: grouped, two decimals, negatives in parentheses. No currency suffix. */
function acct(n: number): string {
  const v = Number(n) || 0;
  const body = fmtAmount(Math.abs(v));
  return v < 0 ? `(${body})` : body;
}

/**
 * Fill each sheet up to `capacity`. A short leftover (a few rows) stays on the
 * previous sheet instead of opening another almost-empty page.
 */
function packRows<T>(rows: T[], capacity: number): T[][] {
  if (rows.length === 0) return [[]];
  if (rows.length <= capacity) return [rows];
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += capacity) pages.push(rows.slice(i, i + capacity));
  const orphanAt = Math.max(3, Math.floor(capacity * 0.35));
  while (pages.length > 1 && pages[pages.length - 1].length <= orphanAt) {
    const tail = pages.pop()!;
    pages[pages.length - 1] = pages[pages.length - 1].concat(tail);
  }
  return pages;
}

const FLOW_LABELS: Record<string, string> = {
  client_in: 'تحصيلات من العملاء',
  supplier_out: 'مدفوعات الموردين',
  service_out: 'خدمات دورية (مدفوعة)',
  payroll_out: 'أجور ورواتب',
  other_out: 'مصاريف أخرى (خزينة)',
};

const FLOW_ORDER = ['client_in', 'supplier_out', 'payroll_out', 'service_out', 'other_out'] as const;

type TreasuryOverview = ReturnType<typeof treasuryOverview>;
type Orient = 'portrait' | 'landscape';

type Sheet = { orient: Orient; body: string };

const PRINT_STYLES = `
  @page sheet-portrait { size: A4 portrait; margin: 10mm 12mm; }
  @page sheet-landscape { size: A4 landscape; margin: 8mm 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif;
    font-size: 11px;
    line-height: 1.45;
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
  .page-inner { flex: 1; padding: 11mm 13mm 6mm; overflow: hidden; }
  .letterhead {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    padding-bottom: 8px;
    border-bottom: 2.5px solid #a16207;
    margin-bottom: 10px;
  }
  .letterhead-en { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; color: #a16207; }
  .letterhead-ar { font-size: 13px; font-weight: 800; margin-top: 1px; }
  .letterhead-meta { text-align: left; direction: ltr; font-size: 9px; color: #78716c; font-variant-numeric: tabular-nums; }
  .doc-title { font-size: 18px; font-weight: 800; margin: 0 0 2px; color: #1c1917; }
  .doc-sub { font-size: 10px; color: #78716c; margin: 0 0 10px; }
  .kpi-row { display: grid; grid-template-columns: 1.1fr 1.4fr 1.1fr; gap: 8px; margin-bottom: 12px; }
  .kpi { border: 1px solid #e7e5e4; border-radius: 6px; padding: 8px 10px; background: #fafaf9; }
  .kpi-label { font-size: 8.5px; font-weight: 700; color: #78716c; letter-spacing: 0.02em; }
  .kpi-value {
    margin-top: 3px;
    font-size: 13px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    direction: ltr;
    text-align: right;
    font-family: 'Segoe UI', Tahoma, sans-serif;
  }
  .kpi-value.hero { font-size: 18px; }
  .neg { color: #9f1239; }
  .pos { color: #047857; }
  .section { margin-top: 10px; }
  .section-title {
    font-size: 12px;
    font-weight: 800;
    margin: 0 0 2px;
    padding-bottom: 3px;
    border-bottom: 1px solid #e7e5e4;
  }
  .section-note { font-size: 9px; color: #a8a29e; margin: 0 0 6px; }
  table.fin {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5px;
    font-variant-numeric: tabular-nums;
  }
  table.fin th {
    background: #292524;
    color: #fafaf9;
    font-weight: 700;
    text-align: right;
    padding: 5px 7px;
    border: 1px solid #292524;
    white-space: nowrap;
  }
  table.fin th.num { text-align: left; direction: ltr; }
  table.fin td {
    padding: 4px 7px;
    border: 1px solid #e7e5e4;
    vertical-align: middle;
  }
  table.fin td.num {
    text-align: right;
    direction: ltr;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-weight: 600;
    white-space: nowrap;
    width: 1%;
  }
  table.fin tr:nth-child(even) td { background: #fafaf9; }
  table.fin tr.total td {
    font-weight: 800;
    background: #f5f5f4 !important;
    border-top: 2px solid #292524;
  }
  table.fin tr.subtotal td { font-weight: 700; background: #fafaf9 !important; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .kind-card { border: 1px solid #e7e5e4; border-radius: 6px; overflow: hidden; }
  .kind-head {
    display: flex; justify-content: space-between; gap: 8px;
    padding: 5px 8px; background: #f5f5f4; font-weight: 800; font-size: 10px;
    border-bottom: 1px solid #e7e5e4;
  }
  .kind-row {
    display: flex; justify-content: space-between; gap: 8px;
    padding: 4px 8px; font-size: 10px; border-bottom: 1px solid #f5f5f4;
  }
  .kind-row:last-child { border-bottom: 0; }
  .kind-name { font-weight: 700; }
  .muted { color: #a8a29e; text-align: center; padding: 8px; font-size: 10px; }
  .page-foot {
    padding: 4px 13mm 8mm;
    display: flex;
    justify-content: space-between;
    font-size: 8.5px;
    color: #a8a29e;
    border-top: 1px solid #e7e5e4;
  }
  .unit-note { font-size: 8.5px; color: #a8a29e; margin: 0 0 4px; text-align: left; direction: ltr; }
  @media print {
    .print-page.orient-portrait, .print-page.orient-landscape {
      width: auto; height: auto; overflow: visible;
    }
  }
`;

function letterhead(printedAt: string, from: string, to: string): string {
  return `<header class="letterhead">
    <div>
      <div class="letterhead-en">SOUTH STREET AGENCY</div>
      <div class="letterhead-ar">وكالة ساوث ستريت — تقرير مالي</div>
    </div>
    <div class="letterhead-meta">
      <div>${escapeHtml(from)} → ${escapeHtml(to)}</div>
      <div>${escapeHtml(printedAt)}</div>
    </div>
  </header>`;
}

function kpiRow(opening: number, closing: number, heroLabel: string): string {
  const net = closing - opening;
  return `<div class="kpi-row">
    <div class="kpi">
      <div class="kpi-label">${escapeHtml(TREASURY_IFRS.colOpening)}</div>
      <div class="kpi-value ${opening < 0 ? 'neg' : ''}">${escapeHtml(acct(opening))}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">${escapeHtml(heroLabel)}</div>
      <div class="kpi-value hero ${closing < 0 ? 'neg' : ''}">${escapeHtml(acct(closing))}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">صافي التغيّر</div>
      <div class="kpi-value ${net < 0 ? 'neg' : 'pos'}">${escapeHtml(acct(net))}</div>
    </div>
  </div>
  <p class="unit-note">Unit: DZD · المبالغ بالدينار الجزائري · السالب بين قوسين</p>`;
}

function section(title: string, note: string | null, body: string): string {
  return `<section class="section">
    <h2 class="section-title">${escapeHtml(title)}</h2>
    ${note ? `<p class="section-note">${escapeHtml(note)}</p>` : ''}
    ${body}
  </section>`;
}

function directoryHtml(overview: TreasuryOverview): string {
  const live = overview.accounts.filter((a) => a.status === 'ACTIVE');
  const cards = TREASURY_KINDS.map((kind) => {
    const rows = live.filter((a) => a.kind === kind.id);
    const sub = rows.reduce((s, a) => s + (a.period_closing ?? a.balance), 0);
    const inner =
      rows.length > 0
        ? rows
            .map(
              (a) =>
                `<div class="kind-row"><span class="kind-name">${escapeHtml(a.name_ar)}</span><span class="num">${escapeHtml(acct(a.period_closing ?? a.balance))}</span></div>`
            )
            .join('')
        : '<div class="muted">لا حساب</div>';
    return `<div class="kind-card">
      <div class="kind-head"><span>${escapeHtml(kind.label)}</span><span>${escapeHtml(acct(sub))}</span></div>
      ${inner}
    </div>`;
  }).join('');
  return `<div class="grid-2">${cards}</div>`;
}

function accountsTable(overview: TreasuryOverview): string {
  const rows = overview.accounts
    .filter((a) => a.status === 'ACTIVE')
    .map(
      (a) => `<tr>
      <td class="kind-name">${escapeHtml(a.name_ar)}</td>
      <td>${escapeHtml(treasuryKindLabel(a.kind))}</td>
      <td class="num">${escapeHtml(acct(a.period_opening ?? 0))}</td>
      <td class="num pos">${escapeHtml(acct(a.period_inflow ?? 0))}</td>
      <td class="num neg">${escapeHtml(acct(a.period_outflow ?? 0))}</td>
      <td class="num">${escapeHtml(acct(a.period_closing ?? a.balance))}</td>
    </tr>`
    )
    .join('');
  const t = overview.accounts_period_totals;
  return `<table class="fin">
    <thead><tr>
      <th>الحساب</th><th>النوع</th>
      <th class="num">افتتاح</th><th class="num">داخل</th><th class="num">خارج</th><th class="num">ختام</th>
    </tr></thead>
    <tbody>
      ${rows || '<tr><td colspan="6" class="muted">لا حسابات</td></tr>'}
      ${
        t
          ? `<tr class="total">
        <td colspan="2">${escapeHtml(TREASURY_IFRS.total)}</td>
        <td class="num">${escapeHtml(acct(t.opening))}</td>
        <td class="num">${escapeHtml(acct(t.inflow))}</td>
        <td class="num">${escapeHtml(acct(t.outflow))}</td>
        <td class="num">${escapeHtml(acct(t.closing))}</td>
      </tr>`
          : ''
      }
    </tbody>
  </table>`;
}

function scfTable(overview: TreasuryOverview): string {
  const cf = overview.cash_flow;
  if (!cf) return '';
  const lines = cf.lines
    .map((l) => {
      const signed = l.kind === 'out' ? -Math.abs(l.amount) : Math.abs(l.amount);
      return `<tr><td>${escapeHtml(l.label)}</td><td class="num ${l.kind === 'out' ? 'neg' : 'pos'}">${escapeHtml(acct(signed))}</td></tr>`;
    })
    .join('');
  return `<table class="fin">
    <thead><tr><th>البند</th><th class="num">المبلغ (دج)</th></tr></thead>
    <tbody>
      <tr class="subtotal"><td>${escapeHtml(TREASURY_IFRS.colOpening)}</td><td class="num">${escapeHtml(acct(overview.period_opening ?? 0))}</td></tr>
      ${lines}
      <tr class="subtotal"><td>صافي التغيّر بالفترة</td><td class="num">${escapeHtml(acct(cf.net))}</td></tr>
      <tr class="total"><td>${escapeHtml(TREASURY_IFRS.colClosing)}</td><td class="num">${escapeHtml(acct(overview.period_closing ?? 0))}</td></tr>
    </tbody>
  </table>`;
}

function flowPages(flowId: string, moves: TreasuryFlowMove[]): Sheet[] {
  const pages = packRows(moves, 18);
  const totalAmt = moves.reduce((s, m) => s + (m.direction === 'out' ? -m.amount : m.amount), 0);
  return pages.map((slice, idx) => {
    const rows = slice
      .map((m) => {
        const signed = m.direction === 'out' ? -m.amount : m.amount;
        const party = m.counterparty || m.staff_name || m.service_name || '—';
        const ref = m.invoice_no || m.package_name || m.period_label || '—';
        return `<tr>
          <td>${escapeHtml(m.entry_date)}</td>
          <td>${escapeHtml(party)}</td>
          <td>${escapeHtml(String(ref).slice(0, 28))}</td>
          <td>${escapeHtml((m.description || m.detail_note || '—').slice(0, 36))}</td>
          <td>${escapeHtml(payMethodLabel(m.method))}</td>
          <td>${escapeHtml(m.account_name || '—')}</td>
          <td class="num ${signed < 0 ? 'neg' : 'pos'}">${escapeHtml(acct(signed))}</td>
        </tr>`;
      })
      .join('');
    const last = idx === pages.length - 1;
    const title = `${FLOW_LABELS[flowId] || flowId}${pages.length > 1 ? ` (${idx + 1}/${pages.length})` : ''}`;
    return {
      orient: 'landscape' as const,
      body: section(
        title,
        'حركات نقدية فعلية · المبالغ بالدينار',
        `<table class="fin">
          <thead><tr>
            <th>التاريخ</th><th>الطرف</th><th>المرجع</th><th>البيان</th><th>الدفع</th><th>حساب الخزينة</th><th class="num">المبلغ (دج)</th>
          </tr></thead>
          <tbody>${rows}
            ${last ? `<tr class="total"><td colspan="6">صافي ${escapeHtml(FLOW_LABELS[flowId] || flowId)}</td><td class="num">${escapeHtml(acct(totalAmt))}</td></tr>` : ''}
          </tbody>
        </table>`
      ),
    };
  });
}

function accountMovePages(
  moves: TreasuryAccountMove[],
  opening: number,
  head: (continued: boolean) => string
): Sheet[] {
  const ordered = [...moves].sort((a, b) =>
    a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : 0
  );
  const balanceAfter = new Map<string, number>();
  let running = opening;
  for (const m of ordered) {
    running += m.direction === 'in' ? m.amount : -m.amount;
    balanceAfter.set(m.id, running);
  }
  const pages = packRows(ordered, 16);
  return pages.map((slice, idx) => {
    const rows = slice
      .map((m) => {
        const signed = m.direction === 'out' ? -m.amount : m.amount;
        const solde = balanceAfter.get(m.id) ?? opening;
        return `<tr>
          <td>${escapeHtml(m.entry_date)}</td>
          <td>${escapeHtml((m.description || '—').slice(0, 42))}</td>
          <td>${escapeHtml((m.counterparty || '—').slice(0, 22))}</td>
          <td>${escapeHtml(payMethodLabel(m.method))}</td>
          <td class="num ${signed < 0 ? 'neg' : 'pos'}">${escapeHtml(acct(signed))}</td>
          <td class="num ${solde < 0 ? 'neg' : ''}">${escapeHtml(acct(solde))}</td>
        </tr>`;
      })
      .join('');
    const openingRow =
      idx === 0
        ? `<tr class="subtotal"><td colspan="4">رصيد أول الفترة</td><td class="num">—</td><td class="num ${opening < 0 ? 'neg' : ''}">${escapeHtml(acct(opening))}</td></tr>`
        : '';
    const last = idx === pages.length - 1;
    return {
      orient: 'portrait' as const,
      body: `${head(idx > 0)}
        ${section(
          pages.length > 1 ? `كشف الحساب (${idx + 1}/${pages.length})` : 'كشف الحساب',
          'المبالغ بالدينار · السالب بين قوسين',
          `<table class="fin">
            <thead><tr>
              <th>التاريخ</th><th>البيان</th><th>الطرف</th><th>الدفع</th>
              <th class="num">المبلغ (دج)</th><th class="num">الرصيد</th>
            </tr></thead>
            <tbody>
              ${openingRow}
              ${rows || '<tr><td colspan="6" class="muted">لا حركات في الفترة</td></tr>'}
              ${last ? `<tr class="total"><td colspan="5">رصيد ختام الفترة</td><td class="num ${running < 0 ? 'neg' : ''}">${escapeHtml(acct(running))}</td></tr>` : ''}
            </tbody>
          </table>`
        )}`,
    };
  });
}

function wrapSheets(title: string, sheets: Sheet[], lh: string): string {
  const total = sheets.length;
  const body = sheets
    .map(
      (sheet, i) => `<section class="print-page orient-${sheet.orient}" data-page="${i + 1}" data-orient="${sheet.orient}">
      <div class="page-inner">
        ${lh}
        ${sheet.body}
      </div>
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

export function buildTreasuryPrintHtml(opts: {
  mode: 'full' | 'recap' | 'account';
  from: string;
  to: string;
  overview: TreasuryOverview;
  accountMoves?: TreasuryAccountMove[];
}): string {
  const { mode, from, to, overview } = opts;
  const printedAt = new Date().toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' });
  const lh = letterhead(printedAt, from, to);
  const closing = overview.period_closing ?? overview.total;
  const opening = overview.period_opening ?? 0;

  if (mode === 'account') {
    const acc = overview.selected_account;
    const docTitle = acc ? `كشف حساب — ${acc.name_ar}` : 'كشف حساب خزينة';
    const openBal = acc?.period_opening ?? opening;
    const bal = acc?.period_closing ?? acc?.balance ?? closing;
    const head = (continued: boolean) =>
      continued
        ? `<h1 class="doc-title">${escapeHtml(docTitle)}</h1><p class="doc-sub">تابع الكشف</p>`
        : `<h1 class="doc-title">${escapeHtml(docTitle)}</h1>
           <p class="doc-sub">${acc ? escapeHtml(treasuryKindLabel(acc.kind)) : ''}${acc?.bank_name ? ` · ${escapeHtml(acc.bank_name)}` : ''}${acc?.account_no ? ` · ${escapeHtml(acc.account_no)}` : ''}</p>
           ${kpiRow(openBal, bal, 'رصيد ختام الحساب')}`;
    return wrapSheets(docTitle, accountMovePages(opts.accountMoves || [], openBal, head), lh);
  }

  const docTitle = mode === 'recap' ? 'ملخص الخزينة' : 'تقرير الخزينة';
  const sheets: Sheet[] = [
    {
      orient: 'portrait',
      body: `
        <h1 class="doc-title">${escapeHtml(docTitle)}</h1>
        <p class="doc-sub">${escapeHtml(TREASURY_IFRS.movementStandard)}</p>
        ${kpiRow(opening, closing, `${TREASURY_IFRS.total} · Solde`)}
        ${section('دليل الحسابات', 'رصيد الختام حسب النوع', directoryHtml(overview))}`,
    },
    {
      orient: 'landscape',
      body: section('تدفقات الخزينة — الطريقة المباشرة', 'تحصيلات ومدفوعات فعلية فقط', scfTable(overview)),
    },
    {
      orient: 'landscape',
      body: section('جدول الحسابات والحركات', 'افتتاح · داخل · خارج · ختام', accountsTable(overview)),
    },
  ];

  if (mode === 'full' && overview.all_flow_moves) {
    for (const fid of FLOW_ORDER) {
      const moves = (overview.all_flow_moves[fid] || []) as TreasuryFlowMove[];
      if (!moves.length) continue;
      sheets.push(...flowPages(fid, moves));
    }
  }

  if (overview.unassigned.count > 0) {
    sheets.push({
      orient: 'portrait',
      body: section(
        'حركات غير مخصّصة لحساب',
        `${fmtCount(overview.unassigned.count)} قيد`,
        `<table class="fin"><tbody>
          <tr class="total"><td>الصافي</td><td class="num">${escapeHtml(acct(overview.unassigned.balance))}</td></tr>
        </tbody></table>`
      ),
    });
  }

  return wrapSheets(docTitle, sheets, lh);
}

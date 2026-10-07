import { fmtAmount } from '@/components/accountant/money';
import { ledgerCategoryLabel } from '@/lib/finance-categories';

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

function numCell(n: number, blankIfZero = false): string {
  if (blankIfZero && !n) return '<td class="num"></td>';
  return `<td class="num${n < 0 ? ' neg' : ''}">${escapeHtml(acct(n))}</td>`;
}

const TYPE_LABEL: Record<string, string> = {
  EXPENSE: 'مصروف',
  PURCHASE: 'شراء',
  SERVICE_SPEND: 'خدمة',
  CASH_IN: 'مقبوضات',
  CASH_OUT: 'مدفوعات',
};

type Posting = { scf_code: string; account_label: string; debit: number; credit: number };

type JournalLine = {
  type: string;
  description: string;
  counterparty: string;
  category: string;
  entry_kind?: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
  postings?: Posting[];
};

type JournalDay = {
  date: string;
  lines: JournalLine[];
  debit: number;
  credit: number;
  closing: number;
  count: number;
};

export type JournalPrint = {
  days: JournalDay[];
  opening: number;
  total_debit: number;
  total_credit: number;
  closing: number;
  count: number;
};

type Row =
  | {
      kind: 'post';
      first: boolean;
      desc: string;
      sub: string;
      category: string;
      scf: string;
      account: string;
      debit: number;
      credit: number;
    }
  | { kind: 'entry'; debit: number; credit: number; balanced: boolean }
  | { kind: 'daytotal'; date: string; debit: number; credit: number; balanced: boolean };

const PRINT_STYLES = `
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
  .print-page.orient-landscape { page: sheet-landscape; width: 297mm; height: 210mm; }
  .page-inner {
    flex: 1; padding: 8mm 10mm 4mm; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .sheet-main { flex: 0 1 auto; }
  .sheet-foot { margin-top: auto; padding-top: 4px; }
  .page-total {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    background: #1e3a8a;
    color: #fff;
    font-weight: 800;
    font-size: 11px;
  }
  .page-total div { padding: 5px 8px; }
  .page-total .page-total-num {
    text-align: right; direction: ltr;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-variant-numeric: tabular-nums;
    background: #1e40af;
  }
  .letterhead {
    display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;
    padding-bottom: 6px; border-bottom: 2.5px solid #a16207; margin-bottom: 6px;
  }
  .letterhead-en { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; color: #a16207; }
  .letterhead-ar { font-size: 13px; font-weight: 800; margin-top: 1px; }
  .letterhead-meta { text-align: left; direction: ltr; font-size: 9px; color: #78716c; font-variant-numeric: tabular-nums; }
  .doc-title { font-size: 14px; font-weight: 800; margin: 0 0 1px; }
  .doc-sub { font-size: 9px; color: #78716c; margin: 0 0 4px; }
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 4px; }
  .kpi { border: 1px solid #e7e5e4; border-radius: 6px; padding: 4px 6px; background: #fafaf9; }
  .kpi-label { font-size: 8.5px; font-weight: 700; color: #78716c; }
  .kpi-value {
    margin-top: 2px; font-size: 12px; font-weight: 800;
    font-variant-numeric: tabular-nums; direction: ltr; text-align: right;
    font-family: 'Segoe UI', Tahoma, sans-serif;
  }
  .neg { color: #9f1239; }
  .unit-note { font-size: 8.5px; color: #a8a29e; margin: 0 0 4px; text-align: left; direction: ltr; }
  table.fin { width: 100%; border-collapse: collapse; font-size: 8px; line-height: 1.2; font-variant-numeric: tabular-nums; }
  table.fin th {
    background: #292524; color: #fafaf9; font-weight: 700; text-align: right;
    padding: 2px 4px; border: 1px solid #292524;
  }
  table.fin th.num, table.fin td.num {
    text-align: right; direction: ltr; font-family: 'Segoe UI', Tahoma, sans-serif;
    font-weight: 600; white-space: nowrap;
  }
  table.fin th.num { text-align: left; }
  table.fin td { padding: 1px 4px; border: 1px solid #e7e5e4; vertical-align: middle; white-space: nowrap; }
  table.fin td.desc { max-width: 78mm; overflow: hidden; text-overflow: ellipsis; }
  .grand {
    margin-top: 6px;
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    border: 2px solid #292524;
  }
  .grand div { padding: 5px 8px; }
  .grand .grand-label { font-weight: 800; background: #292524; color: #fafaf9; }
  .grand .grand-num {
    font-weight: 800; text-align: right; direction: ltr;
    font-family: 'Segoe UI', Tahoma, sans-serif; font-variant-numeric: tabular-nums;
    background: #f5f5f4;
  }
  table.fin tr.entry-total td {
    font-weight: 800;
    background: #fef3c7;
    color: #78350f;
  }
  table.fin tr.entry-total td.num { color: #78350f; }
  table.fin tr.day-total td {
    font-weight: 800;
    background: #fcd34d;
    color: #78350f;
  }
  table.fin tr.day-total td.num { color: #78350f; }
  table.fin tr.entry-total.is-bad td { color: #9f1239; }
  .muted { color: #a8a29e; font-size: 8px; }
  .page-foot {
    padding: 3px 10mm 6mm; display: flex; justify-content: space-between;
    font-size: 8.5px; color: #a8a29e; border-top: 1px solid #e7e5e4;
  }
  @media print {
    .print-page.orient-landscape { width: auto; height: auto; overflow: visible; }
  }
`;

function linePostings(line: JournalLine): Posting[] {
  if (line.postings && line.postings.length > 0) return line.postings;
  return [{ scf_code: '—', account_label: line.account_name || '—', debit: line.debit, credit: line.credit }];
}

function sides(postings: Posting[]) {
  const debit = postings.reduce((s, p) => s + (Number(p.debit) || 0), 0);
  const credit = postings.reduce((s, p) => s + (Number(p.credit) || 0), 0);
  return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 };
}

function balanceCell(balanced: boolean): string {
  return `<td>${balanced ? 'متوازن' : 'غير متوازن'}</td>`;
}

function flatten(journal: JournalPrint): { rows: Row[]; debit: number; credit: number; balanced: boolean } {
  const rows: Row[] = [];
  let debit = 0;
  let credit = 0;
  let unbalanced = 0;
  const days = [...journal.days].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const day of days) {
    let dayDebit = 0;
    let dayCredit = 0;
    let dayUnbalanced = 0;
    for (const line of day.lines) {
      const postings = linePostings(line);
      const totals = sides(postings);
      dayDebit += totals.debit;
      dayCredit += totals.credit;
      if (!totals.balanced) dayUnbalanced += 1;
      const desc = line.description || line.counterparty || TYPE_LABEL[line.type] || line.type || '—';
      const sub = [
        line.counterparty && line.description ? line.counterparty : '',
        line.entry_kind === 'accrual' ? 'قيد استحقاق' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      postings.forEach((p, idx) => {
        rows.push({
          kind: 'post',
          first: idx === 0,
          desc: idx === 0 ? desc : '',
          sub: idx === 0 ? sub : '',
          category: idx === 0 ? ledgerCategoryLabel(line.category) : '',
          scf: p.scf_code || '—',
          account: String(p.account_label || '').replace(/^\d+\s*—\s*/, ''),
          debit: Number(p.debit) || 0,
          credit: Number(p.credit) || 0,
        });
      });
      rows.push({ kind: 'entry', debit: totals.debit, credit: totals.credit, balanced: totals.balanced });
    }
    debit += dayDebit;
    credit += dayCredit;
    unbalanced += dayUnbalanced;
    rows.push({
      kind: 'daytotal',
      date: day.date,
      debit: dayDebit,
      credit: dayCredit,
      balanced: dayUnbalanced === 0,
    });
  }
  return { rows, debit, credit, balanced: unbalanced === 0 };
}

/** Sum each operation once. A قيد split onto this page still counts its lines here. */
function pageMovement(rows: Row[]) {
  let debit = 0;
  let credit = 0;
  let openDebit = 0;
  let openCredit = 0;
  for (const row of rows) {
    if (row.kind === 'post') {
      openDebit += row.debit;
      openCredit += row.credit;
      continue;
    }
    if (row.kind === 'entry') {
      debit += row.debit;
      credit += row.credit;
      openDebit = 0;
      openCredit = 0;
    }
  }
  return { debit: debit + openDebit, credit: credit + openCredit };
}

function renderRow(row: Row): string {
  if (row.kind === 'entry') {
    return `<tr class="entry-total${row.balanced ? '' : ' is-bad'}"><td colspan="3">مجموع القيد — مدين / دائن</td>${numCell(row.debit)}${numCell(row.credit)}${balanceCell(row.balanced)}</tr>`;
  }
  if (row.kind === 'daytotal') {
    return `<tr class="day-total"><td colspan="3">إجمالي يوم ${escapeHtml(row.date)}</td>${numCell(row.debit)}${numCell(row.credit)}${balanceCell(row.balanced)}</tr>`;
  }
  const account = [row.scf, row.account].filter((part) => part && part !== '—').join(' — ') || '—';
  return `<tr class="${row.first ? 'entry-start' : ''}">
    <td class="desc">${escapeHtml(row.desc)}${row.sub ? ` · ${escapeHtml(row.sub)}` : ''}</td>
    <td>${escapeHtml(row.category)}</td>
    <td>${escapeHtml(account)}</td>
    ${numCell(row.debit, true)}
    ${numCell(row.credit, true)}
    <td></td>
  </tr>`;
}

/** One line per row. First page leaves room for the KPI band. */
const FIRST_PAGE_ROWS = 40;
const NEXT_PAGE_ROWS = 44;

function packPages(rows: Row[]): Row[][] {
  const groups: Row[][] = [];
  let group: Row[] = [];
  const push = () => {
    if (group.length) groups.push(group);
    group = [];
  };
  for (const row of rows) {
    if (row.kind === 'daytotal') {
      push();
      groups.push([row]);
      continue;
    }
    if (row.kind === 'post' && row.first) push();
    group.push(row);
    if (row.kind === 'entry') push();
  }
  push();

  const pages: Row[][] = [];
  let page: Row[] = [];
  for (const block of groups) {
    const cap = pages.length === 0 ? FIRST_PAGE_ROWS : NEXT_PAGE_ROWS;
    if (page.length && page.length + block.length > cap) {
      pages.push(page);
      page = [];
    }
    const rowCap = pages.length === 0 && page.length === 0 ? FIRST_PAGE_ROWS : pages.length === 0 ? FIRST_PAGE_ROWS : NEXT_PAGE_ROWS;
    if (block.length > rowCap && page.length === 0) {
      for (const row of block) {
        const splitCap = pages.length === 0 ? FIRST_PAGE_ROWS : NEXT_PAGE_ROWS;
        if (page.length >= splitCap) {
          pages.push(page);
          page = [];
        }
        page.push(row);
      }
      continue;
    }
    page.push(...block);
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}

export function buildJournalPrintHtml(input: {
  from: string;
  to: string;
  categoryLabel?: string;
  query?: string;
  journal: JournalPrint;
}): string {
  const printedAt = new Date().toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' });
  const period = input.from || input.to ? `${input.from || '…'} → ${input.to || '…'}` : 'كل الفترات';
  const filterBits = [input.categoryLabel, input.query ? `بحث: ${input.query}` : ''].filter(Boolean);
  const flat = flatten(input.journal);
  const pages = packPages(flat.rows);
  const j = input.journal;

  const sheets = pages.map((page, index) => {
    const body = page.map((row) => renderRow(row)).join('');
    const pageSum = pageMovement(page);
    const head =
      index === 0
        ? `<h1 class="doc-title">اليومية العامة</h1>
           <p class="doc-sub">كل قيد مدين ودائن متساويان${filterBits.length ? ` · ${escapeHtml(filterBits.join(' · '))}` : ''} · ${escapeHtml(period)}</p>
           <div class="kpi-row">
             <div class="kpi"><div class="kpi-label">مدين القيود (دج)</div><div class="kpi-value">${escapeHtml(acct(flat.debit))}</div></div>
             <div class="kpi"><div class="kpi-label">دائن القيود (دج)</div><div class="kpi-value">${escapeHtml(acct(flat.credit))}</div></div>
             <div class="kpi"><div class="kpi-label">الفرق</div><div class="kpi-value${flat.balanced ? '' : ' neg'}">${escapeHtml(acct(flat.debit - flat.credit))}</div></div>
             <div class="kpi"><div class="kpi-label">الحالة</div><div class="kpi-value">${flat.balanced ? 'متوازن' : 'غير متوازن'} · ${j.count}</div></div>
           </div>`
        : `<h1 class="doc-title">اليومية العامة</h1><p class="doc-sub">تابع اليومية · ${escapeHtml(period)}</p>`;
    const last = index === pages.length - 1;
    return `<div class="sheet-main">${head}
      <p class="unit-note">DZD · القيد متوازن عندما المدين = الدائن</p>
      <table class="fin">
        <thead><tr>
          <th>البيان</th><th>التصنيف</th><th>الحساب (SCF)</th>
          <th class="num">مدين</th><th class="num">دائن</th><th>التوازن</th>
        </tr></thead>
        <tbody>
          ${body || '<tr><td colspan="6">لا قيود في هذه الفترة</td></tr>'}
        </tbody>
      </table></div>
      <div class="sheet-foot">
        <div class="page-total">
          <div>مجموع الصفحة</div>
          <div class="page-total-num">مدين ${escapeHtml(acct(pageSum.debit))}</div>
          <div class="page-total-num">دائن ${escapeHtml(acct(pageSum.credit))}</div>
        </div>
        ${
          last
            ? `<div class="grand">
                <div class="grand-label">المجموع العام · ${j.count} قيد</div>
                <div class="grand-num">مدين ${escapeHtml(acct(flat.debit))}</div>
                <div class="grand-num">دائن ${escapeHtml(acct(flat.credit))}</div>
              </div>`
            : ''
        }
      </div>`;
  });

  const total = sheets.length;
  const pagesHtml = sheets
    .map(
      (sheet, i) => `<section class="print-page orient-landscape" data-page="${i + 1}" data-orient="landscape">
      <div class="page-inner">
        <header class="letterhead">
          <div>
            <div class="letterhead-en">SOUTH STREET AGENCY</div>
            <div class="letterhead-ar">وكالة ساوث ستريت — اليومية العامة</div>
          </div>
          <div class="letterhead-meta"><div>${escapeHtml(period)}</div><div>${escapeHtml(printedAt)}</div></div>
        </header>
        ${sheet}
      </div>
      <footer class="page-foot"><span>اليومية العامة · A4 أفقي</span><span>صفحة ${i + 1} من ${total}</span></footer>
    </section>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>اليومية العامة</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;800&display=swap" rel="stylesheet" />
  <style>${PRINT_STYLES}</style>
</head>
<body>${pagesHtml}</body>
</html>`;
}

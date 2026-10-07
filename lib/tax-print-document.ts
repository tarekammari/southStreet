import { fmtAmount } from '@/components/accountant/money';
import { TAX_BUCKETS, type TaxBucketId } from '@/lib/tax-buckets';

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

type Sheet = { orient: 'portrait'; body: string };

export type TaxPrintLine = {
  bucket: TaxBucketId;
  entry_date: string;
  description: string;
  amount: number;
};

const PRINT_STYLES = `
  @page sheet-portrait { size: A4 portrait; margin: 10mm 12mm; }
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
  table.fin tr.group td { background: #44403c; color: #fafaf9; font-weight: 800; }
  table.fin tr.total td { font-weight: 800; background: #f5f5f4; border-top: 1.5px solid #292524; }
  .page-foot {
    padding: 3px 12mm 7mm; display: flex; justify-content: space-between;
    font-size: 8.5px; color: #a8a29e; border-top: 1px solid #e7e5e4;
  }
  @media print {
    .print-page.orient-portrait { width: auto; height: auto; overflow: visible; }
  }
`;

function numCell(n: number): string {
  return `<td class="num">${escapeHtml(acct(n))}</td>`;
}

function chunks<T>(rows: T[], size: number): T[][] {
  if (!rows.length) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export function buildTaxPrintHtml(input: { from: string; to: string; lines: TaxPrintLine[] }): string {
  const printedAt = new Date().toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' });
  const totals = Object.fromEntries(TAX_BUCKETS.map((b) => [b.id, 0])) as Record<TaxBucketId, number>;
  for (const line of input.lines) totals[line.bucket] += Number(line.amount) || 0;
  const grand = TAX_BUCKETS.reduce((s, b) => s + totals[b.id], 0);
  const ordered = TAX_BUCKETS.flatMap((b) => input.lines.filter((l) => l.bucket === b.id));
  const pages = chunks(ordered, 16);
  const period = `${input.from} → ${input.to}`;

  const sheets: Sheet[] = pages.map((page, index) => {
    let lastBucket = '';
    const rows = page
      .map((line) => {
        const bucket = TAX_BUCKETS.find((b) => b.id === line.bucket);
        const head =
          line.bucket !== lastBucket
            ? `<tr class="group"><td colspan="4">${escapeHtml(bucket?.code || '')} — ${escapeHtml(bucket?.label || '')}</td></tr>`
            : '';
        lastBucket = line.bucket;
        return `${head}<tr><td>${escapeHtml(line.entry_date || '—')}</td><td>${escapeHtml(line.description || '—')}</td><td>${escapeHtml(bucket?.code || '—')}</td>${numCell(line.amount)}</tr>`;
      })
      .join('');
    const head =
      index === 0
        ? `<h1 class="doc-title">الضرائب والرسوم</h1>
           <p class="doc-sub">SCF · 64 · 447 · 695 · ${escapeHtml(period)}</p>
           <div class="kpi-row">
             ${TAX_BUCKETS.map(
               (b) =>
                 `<div class="kpi"><div class="kpi-label">${escapeHtml(b.code)} ${escapeHtml(b.label)}</div><div class="kpi-value">${escapeHtml(acct(totals[b.id]))}</div></div>`
             ).join('')}
             <div class="kpi"><div class="kpi-label">المجموع (دج)</div><div class="kpi-value">${escapeHtml(acct(grand))}</div></div>
           </div>`
        : `<h1 class="doc-title">الضرائب والرسوم</h1><p class="doc-sub">تابع الكشف · ${escapeHtml(period)}</p>`;
    return {
      orient: 'portrait' as const,
      body: `${head}
        <p class="unit-note">DZD</p>
        <table class="fin">
          <thead><tr><th>التاريخ</th><th>البيان</th><th>الحساب</th><th class="num">المبلغ (دج)</th></tr></thead>
          <tbody>
            ${rows || '<tr><td colspan="4">لا قيود ضريبية أو رسوم في هذه الفترة</td></tr>'}
            ${index === pages.length - 1 ? `<tr class="total"><td colspan="3">المجموع</td>${numCell(grand)}</tr>` : ''}
          </tbody>
        </table>`,
    };
  });

  const total = sheets.length;
  const body = sheets
    .map(
      (sheet, i) => `<section class="print-page orient-portrait" data-page="${i + 1}" data-orient="portrait">
      <div class="page-inner"><header class="letterhead">
        <div>
          <div class="letterhead-en">SOUTH STREET AGENCY</div>
          <div class="letterhead-ar">وكالة ساوث ستريت — الضرائب والرسوم</div>
        </div>
        <div class="letterhead-meta"><div>${escapeHtml(period)}</div><div>${escapeHtml(printedAt)}</div></div>
      </header>${sheet.body}</div>
      <footer class="page-foot"><span>الضرائب والرسوم · A4 عمودي</span><span>صفحة ${i + 1} من ${total}</span></footer>
    </section>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>الضرائب والرسوم</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;800&display=swap" rel="stylesheet" />
  <style>${PRINT_STYLES}</style>
</head>
<body>${body}</body>
</html>`;
}

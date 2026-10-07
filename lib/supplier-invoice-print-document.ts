import { fmtAmount, payMethodLabel } from '@/components/accountant/money';
import { amountInWordsFrDzd, INVOICE_DISCOUNT_KINDS } from '@/lib/algerian-invoice-decree';
import {
  computeSupplierInvoiceTotals,
  detailFromLegacyInvoice,
  lineTotalHt,
  parseSupplierInvoiceDetail,
  SUPPLIER_INVOICE_AGENCY_COPY_AR,
  SUPPLIER_INVOICE_AGENCY_COPY_FR,
  type SupplierInvoiceDetail,
} from '@/lib/supplier-invoice-document';

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function acct(n: number): string {
  return fmtAmount(Number(n) || 0);
}

const PRINT_STYLES = `
  @page sheet-portrait { size: A4 portrait; margin: 10mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; font-size: 11px; color: #1c1917; }
  .print-page { position: relative; width: 210mm; min-height: 297mm; page-break-after: always; }
  .agency-watermark {
    position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0;
  }
  .agency-watermark span {
    position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%) rotate(-32deg);
    font-size: 22px; font-weight: 800; color: rgba(190, 18, 60, 0.12); white-space: nowrap;
    letter-spacing: 0.04em; text-align: center; line-height: 1.5;
  }
  .page-inner { position: relative; z-index: 1; padding: 10mm 12mm 14mm; }
  .copy-banner {
    background: #fff1f2; border: 1.5px solid #fda4af; border-radius: 6px;
    padding: 8px 10px; margin-bottom: 10px; font-size: 10px; font-weight: 700; color: #9f1239;
    line-height: 1.45;
  }
  .copy-banner small { display: block; font-weight: 600; opacity: 0.85; margin-top: 3px; }
  .sheet-head {
    display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
    padding-bottom: 10px; border-bottom: 2.5px solid #a16207; margin-bottom: 12px;
  }
  .brand-en { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; color: #a16207; margin: 0; }
  .brand-title { margin: 2px 0 0; font-size: 22px; font-weight: 900; letter-spacing: 0.08em; }
  .brand-ar { margin: 4px 0 0; font-size: 10px; font-weight: 700; opacity: 0.55; }
  .meta { direction: ltr; text-align: left; font-size: 10px; font-variant-numeric: tabular-nums; }
  .meta div { margin-top: 4px; }
  .meta strong { font-weight: 800; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 12px; }
  .party h2 { margin: 0 0 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; color: #78716c; }
  .party .name { font-size: 12px; font-weight: 900; margin: 0; }
  .party p { margin: 3px 0 0; font-size: 10px; opacity: 0.75; }
  table.lines { width: 100%; border-collapse: collapse; border: 1px solid #292524; margin-bottom: 10px; }
  table.lines th { background: #292524; color: #fff; font-size: 9px; padding: 7px 8px; text-align: right; }
  table.lines td { padding: 7px 8px; border-top: 1px solid #e7e5e4; vertical-align: top; font-size: 10px; }
  td.num { direction: ltr; text-align: left; font-variant-numeric: tabular-nums; font-weight: 700; }
  .bottom { display: grid; grid-template-columns: 1fr 240px; gap: 16px; align-items: start; }
  .totals { border: 1px solid #292524; border-radius: 4px; overflow: hidden; }
  .totals .row { display: flex; justify-content: space-between; padding: 7px 10px; border-bottom: 1px solid #e7e5e4; font-size: 10px; }
  .totals .row:last-child { border-bottom: none; }
  .totals .row.ttc { background: #292524; color: #fff; font-weight: 800; font-size: 11px; }
  .totals .row span:last-child { direction: ltr; font-variant-numeric: tabular-nums; }
  .payment { font-size: 10px; line-height: 1.5; }
  .payment h3 { margin: 0 0 6px; font-size: 9px; text-transform: uppercase; opacity: 0.55; }
  .words { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #d6d3d1; font-style: italic; }
  .foot { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e7e5e4; font-size: 8px; opacity: 0.5; display: flex; justify-content: space-between; }
`;

export function buildSupplierInvoiceAgencyCopyHtml(input: {
  supplier: { name_ar: string; code?: string; contact?: string };
  invoice: {
    invoice_no: string;
    invoice_date: string;
    due_date: string;
    amount_ht?: number | null;
    discount?: number | null;
    tax_rate?: number | null;
    tax_amount?: number | null;
    amount: number;
    paid_amount?: number | null;
    remaining?: number | null;
    note?: string | null;
    detail_json?: string | null;
  };
}): string {
  const inv = input.invoice;
  let detail: SupplierInvoiceDetail =
    parseSupplierInvoiceDetail(inv.detail_json) ||
    detailFromLegacyInvoice({
      amount_ht: inv.amount_ht,
      discount: inv.discount,
      tax_rate: inv.tax_rate,
      note: inv.note,
    });
  const discount = Number(inv.discount) || 0;
  const totals = computeSupplierInvoiceTotals({
    lines: detail.lines,
    discount,
    taxes: detail.taxes,
    vatExempt: detail.vatExempt,
  });
  const payLabel = payMethodLabel(detail.paymentMethod);
  const discountKind = INVOICE_DISCOUNT_KINDS.find((k) => k.id === detail.discountKind)?.label || '';

  const lineRows = detail.lines
    .map(
      (l) => `
    <tr>
      <td>${escapeHtml(l.designation.trim() || '—')}</td>
      <td class="num">${acct(l.quantity)}</td>
      <td class="num">${acct(l.unitPriceHt)}</td>
      <td class="num">${acct(lineTotalHt(l))}</td>
    </tr>`
    )
    .join('');

  const taxRows = totals.taxLines
    .map((t) => {
      const label =
        t.mode === 'amount' ? t.label : `${t.label}${t.rate ? ` (${t.rate}%)` : ''}`;
      return `<div class="row"><span>${escapeHtml(label)}</span><span>${acct(t.amount)} DZD</span></div>`;
    })
    .join('');

  const body = `
  <div class="print-page orient-portrait" data-orient="portrait">
    <div class="agency-watermark"><span>${escapeHtml(SUPPLIER_INVOICE_AGENCY_COPY_FR)}<br/>${escapeHtml(SUPPLIER_INVOICE_AGENCY_COPY_AR)}</span></div>
    <div class="page-inner">
      <div class="copy-banner">
        ${escapeHtml(SUPPLIER_INVOICE_AGENCY_COPY_AR)}
        <small>${escapeHtml(SUPPLIER_INVOICE_AGENCY_COPY_FR)}</small>
      </div>
      <header class="sheet-head">
        <div>
          <p class="brand-en">SOUTH STREET AGENCY</p>
          <h1 class="brand-title">FACTURE · COPIE AGENCE</h1>
          <p class="brand-ar">فاتورة مورد — نسخة محاسبية · مرسوم 05-468</p>
        </div>
        <div class="meta">
          <div><strong>N°</strong> ${escapeHtml(inv.invoice_no || '—')}</div>
          <div><strong>Date</strong> ${escapeHtml(String(inv.invoice_date || '').slice(0, 10))}</div>
          <div><strong>Échéance</strong> ${escapeHtml(String(inv.due_date || '').slice(0, 10))}</div>
        </div>
      </header>
      <div class="parties">
        <section class="party">
          <h2>Fournisseur · البائع</h2>
          <p class="name">${escapeHtml(input.supplier.name_ar)}</p>
          ${input.supplier.code ? `<p>${escapeHtml(input.supplier.code)}</p>` : ''}
          ${detail.sellerRc ? `<p>RC: ${escapeHtml(detail.sellerRc)}</p>` : ''}
          ${detail.sellerNif ? `<p>NIF: ${escapeHtml(detail.sellerNif)}</p>` : ''}
        </section>
        <section class="party">
          <h2>Client · المشتري</h2>
          <p class="name">وكالة ساوث ستريت</p>
          <p>الجزائر</p>
          ${detail.buyerRc ? `<p>RC: ${escapeHtml(detail.buyerRc)}</p>` : ''}
          ${detail.buyerNif ? `<p>NIF: ${escapeHtml(detail.buyerNif)}</p>` : ''}
        </section>
      </div>
      <table class="lines">
        <thead><tr>
          <th>Désignation · البيان</th><th>Qté</th><th>PU HT</th><th>Total HT</th>
        </tr></thead>
        <tbody>${lineRows || '<tr><td colspan="4">—</td></tr>'}</tbody>
      </table>
      ${discountKind && discountKind !== '—' ? `<p style="font-size:9px;margin:0 0 8px;opacity:.65">نوع الحسم: ${escapeHtml(discountKind)}</p>` : ''}
      <div class="bottom">
        <div class="payment">
          <h3>Conditions de règlement</h3>
          <p>Mode: ${escapeHtml(payLabel)}</p>
          <p>Échéance: ${escapeHtml(String(inv.due_date || '').slice(0, 10))}</p>
          <p class="words">Arrêtée à la somme de: ${escapeHtml(amountInWordsFrDzd(totals.ttc))}</p>
        </div>
        <div class="totals">
          <div class="row"><span>Total HT brut</span><span>${acct(totals.ht)} DZD</span></div>
          ${totals.discount > 0 ? `<div class="row"><span>Remise</span><span>− ${acct(totals.discount)} DZD</span></div>` : ''}
          <div class="row"><span>Net HT</span><span>${acct(totals.net)} DZD</span></div>
          ${detail.vatExempt ? `<div class="row"><span>TVA</span><span>Exonéré</span></div>` : ''}
          ${taxRows}
          <div class="row ttc"><span>Total TTC</span><span>${acct(totals.ttc)} DZD</span></div>
          ${Number(inv.paid_amount) > 0 ? `<div class="row"><span>Payé</span><span>${acct(Number(inv.paid_amount))} DZD</span></div>` : ''}
          ${Number(inv.remaining) > 0 ? `<div class="row"><span>Reste</span><span>${acct(Number(inv.remaining))} DZD</span></div>` : ''}
        </div>
      </div>
      <footer class="foot">
        <span>${escapeHtml(payLabel)}</span>
        <span>${escapeHtml(String(inv.invoice_date || '').slice(0, 10))}</span>
      </footer>
    </div>
  </div>`;

  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><style>${PRINT_STYLES}</style></head><body>${body}</body></html>`;
}

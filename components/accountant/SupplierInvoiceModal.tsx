'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import AcctPrintButton from './AcctPrintButton';
import { fmtAmountEn, parseAmountInput, PAY_METHODS } from './money';
import { amountInWordsFrDzd, INVOICE_DISCOUNT_KINDS, type InvoiceDiscountKind } from '@/lib/algerian-invoice-decree';
import {
  lineTotalHt,
  taxAmountOnNet,
  type SupplierInvoiceLine,
  type SupplierInvoiceTax,
  type TaxMode,
} from '@/lib/supplier-invoice-document';

export type SupplierInvoiceParty = {
  name: string;
  code?: string;
  address?: string;
  phone?: string;
};

export type SupplierInvoiceMath = {
  ht: number;
  discount: number;
  net: number;
  taxLines: { id: string; label: string; rate: number; amount: number; mode: TaxMode; role: 'tva' | 'other' }[];
  tax: number;
  ttc: number;
  reste: number;
};

export type SupplierInvoiceFormProps = {
  editing: boolean;
  busy: boolean;
  err: string;
  seller: SupplierInvoiceParty;
  buyer: SupplierInvoiceParty;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  lines: SupplierInvoiceLine[];
  taxes: SupplierInvoiceTax[];
  discount: number;
  discountKind: InvoiceDiscountKind;
  vatExempt: boolean;
  paymentMethod: string;
  math: SupplierInvoiceMath;
  sellerRc: string;
  sellerNif: string;
  buyerRc: string;
  buyerNif: string;
  canPrint?: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onPrint?: () => void;
  onAddLine: () => void;
  onRemoveLine: (id: string) => void;
  onAddTax: () => void;
  onRemoveTax: (id: string) => void;
  onChange: (patch: Partial<{
    invoiceNo: string;
    invoiceDate: string;
    dueDate: string;
    discount: number;
    discountKind: InvoiceDiscountKind;
    vatExempt: boolean;
    paymentMethod: string;
    sellerRc: string;
    sellerNif: string;
    buyerRc: string;
    buyerNif: string;
  }>) => void;
  onChangeLine: (id: string, patch: Partial<Pick<SupplierInvoiceLine, 'designation' | 'quantity' | 'unitPriceHt'>>) => void;
  onChangeTax: (id: string, patch: Partial<Pick<SupplierInvoiceTax, 'label' | 'rate' | 'amount' | 'mode'>>) => void;
};

function AmountInput({
  value,
  onChange,
  className,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft('');
  }, [value, focused]);

  return (
    <input
      dir="ltr"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      className={className}
      value={focused ? draft : fmtAmountEn(value, { currency: false })}
      onFocus={() => {
        setDraft(fmtAmountEn(value, { currency: false }));
        setFocused(true);
      }}
      onBlur={() => {
        onChange(parseAmountInput(draft));
        setFocused(false);
      }}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}

export function SupplierInvoiceForm(props: SupplierInvoiceFormProps) {
  const tva = props.taxes.find((t) => t.role === 'tva');
  const others = props.taxes.filter((t) => t.role !== 'tva');
  const tvaAmount = tva ? taxAmountOnNet(tva, props.math.net, props.vatExempt) : 0;
  const payLabel = PAY_METHODS.find((m) => m.value === props.paymentMethod)?.label || props.paymentMethod;

  return (
    <form className="acct-inv-form" onSubmit={props.onSubmit}>
      {props.readOnly ? <p className="acct-inv-void-note">فاتورة ملغاة — للعرض فقط</p> : null}
      <fieldset disabled={props.readOnly} className="acct-inv-fieldset">
      <article className="acct-inv-sheet">
        <header className="acct-inv-sheet-head">
          <div className="acct-inv-brand">
            <p className="acct-inv-brand-en">SOUTH STREET</p>
            <h1 className="acct-inv-brand-title">فاتورة مورد</h1>
            <p className="acct-inv-brand-ar">نسخة الوكالة</p>
          </div>
          <div className="acct-inv-doc-meta">
            <label>
              <span>الرقم</span>
              <input
                className="acct-inv-field acct-inv-field-em"
                placeholder="FAC-2026-001"
                value={props.invoiceNo}
                onChange={(e) => props.onChange({ invoiceNo: e.target.value })}
              />
            </label>
            <label>
              <span>التاريخ</span>
              <input
                type="date"
                required
                className="acct-inv-field"
                value={props.invoiceDate}
                onChange={(e) => props.onChange({ invoiceDate: e.target.value })}
              />
            </label>
            <label>
              <span>الاستحقاق</span>
              <input
                type="date"
                required
                className="acct-inv-field"
                value={props.dueDate}
                min={props.invoiceDate}
                onChange={(e) => props.onChange({ dueDate: e.target.value })}
              />
            </label>
          </div>
        </header>

        <div className="acct-inv-parties">
          <section className="acct-inv-party">
            <h2>المورد</h2>
            <p className="acct-inv-party-name">{props.seller.name}</p>
            {props.seller.code ? <p className="acct-inv-party-line font-mono">{props.seller.code}</p> : null}
            <div className="acct-inv-party-ids">
              <label className="acct-inv-id-field">
                <span>RC</span>
                <input className="acct-inv-field" value={props.sellerRc} onChange={(e) => props.onChange({ sellerRc: e.target.value })} />
              </label>
              <label className="acct-inv-id-field">
                <span>NIF</span>
                <input className="acct-inv-field" value={props.sellerNif} onChange={(e) => props.onChange({ sellerNif: e.target.value })} />
              </label>
            </div>
          </section>
          <section className="acct-inv-party">
            <h2>الوكالة</h2>
            <p className="acct-inv-party-name">{props.buyer.name}</p>
            <div className="acct-inv-party-ids">
              <label className="acct-inv-id-field">
                <span>RC</span>
                <input className="acct-inv-field" value={props.buyerRc} onChange={(e) => props.onChange({ buyerRc: e.target.value })} />
              </label>
              <label className="acct-inv-id-field">
                <span>NIF</span>
                <input className="acct-inv-field" value={props.buyerNif} onChange={(e) => props.onChange({ buyerNif: e.target.value })} />
              </label>
            </div>
          </section>
        </div>

        <div className="acct-inv-lines-toolbar">
          <span className="acct-inv-lines-title">البنود</span>
          <button type="button" className="acct-inv-line-add" onClick={props.onAddLine}>
            <Plus className="w-3.5 h-3.5" aria-hidden />
            بند
          </button>
        </div>

        <div className="acct-inv-line-table">
          <div className="acct-inv-line acct-inv-line-head">
            <span>البيان</span>
            <span>الكمية</span>
            <span>سعر الوحدة</span>
            <span>المبلغ</span>
            <span />
          </div>
          {props.lines.map((line) => (
            <div key={line.id} className="acct-inv-line">
              <input
                className="acct-inv-field"
                placeholder="وصف السلعة أو الخدمة"
                value={line.designation}
                onChange={(e) => props.onChangeLine(line.id, { designation: e.target.value })}
              />
              <AmountInput
                className="acct-inv-field acct-inv-field-num"
                value={line.quantity}
                onChange={(n) => props.onChangeLine(line.id, { quantity: Math.max(0, n) })}
              />
              <AmountInput
                className="acct-inv-field acct-inv-field-num"
                value={line.unitPriceHt}
                onChange={(n) => props.onChangeLine(line.id, { unitPriceHt: Math.max(0, n) })}
              />
              <span className="acct-inv-line-amt" dir="ltr">
                {fmtAmountEn(lineTotalHt(line), { currency: false })}
              </span>
              <button
                type="button"
                className="acct-inv-icon-btn"
                title="حذف"
                disabled={props.lines.length <= 1}
                onClick={() => props.onRemoveLine(line.id)}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>

        <div className="acct-inv-remise">
          <label>
            <span>الحسم</span>
            <select
              className="acct-inv-field"
              value={props.discountKind}
              onChange={(e) => props.onChange({ discountKind: e.target.value as InvoiceDiscountKind })}
            >
              {INVOICE_DISCOUNT_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.id === 'none' ? 'بدون' : k.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>مبلغ الحسم</span>
            <AmountInput
              className="acct-inv-field acct-inv-field-num"
              value={props.discount}
              onChange={(n) => props.onChange({ discount: Math.max(0, n) })}
            />
          </label>
        </div>

        {tva ? (
          <div className="acct-inv-tva-row">
            <span className="acct-inv-tva-name">TVA</span>
            <label>
              <span>%</span>
              <AmountInput
                className="acct-inv-field acct-inv-field-num"
                disabled={props.vatExempt}
                value={tva.rate}
                onChange={(n) => props.onChangeTax(tva.id, { rate: Math.min(100, Math.max(0, n)), mode: 'percent' })}
              />
            </label>
            <span className="acct-inv-line-amt" dir="ltr">
              {props.vatExempt ? 'معفى' : fmtAmountEn(tvaAmount, { currency: false })}
            </span>
            <label className="acct-inv-check-inline">
              <input
                type="checkbox"
                checked={props.vatExempt}
                onChange={(e) => props.onChange({ vatExempt: e.target.checked })}
              />
              <span>معفى</span>
            </label>
          </div>
        ) : null}

        <div className="acct-inv-lines-toolbar">
          <span className="acct-inv-lines-title">ضرائب أخرى</span>
          <button type="button" className="acct-inv-line-add" onClick={props.onAddTax}>
            <Plus className="w-3.5 h-3.5" aria-hidden />
            ضريبة
          </button>
        </div>

        {others.length > 0 ? (
          <div className="acct-inv-other-taxes">
            {others.map((tax) => {
              const computed = taxAmountOnNet(tax, props.math.net, false);
              return (
                <div key={tax.id} className="acct-inv-tax-line">
                  <input
                    className="acct-inv-field"
                    placeholder="اسم الضريبة"
                    value={tax.label}
                    onChange={(e) => props.onChangeTax(tax.id, { label: e.target.value })}
                  />
                  <select
                    className="acct-inv-field"
                    value={tax.mode}
                    onChange={(e) => props.onChangeTax(tax.id, { mode: e.target.value as TaxMode })}
                  >
                    <option value="percent">نسبة %</option>
                    <option value="amount">مبلغ</option>
                  </select>
                  {tax.mode === 'amount' ? (
                    <AmountInput
                      className="acct-inv-field acct-inv-field-num"
                      value={tax.amount}
                      onChange={(n) => props.onChangeTax(tax.id, { amount: Math.max(0, n) })}
                    />
                  ) : (
                    <AmountInput
                      className="acct-inv-field acct-inv-field-num"
                      value={tax.rate}
                      onChange={(n) => props.onChangeTax(tax.id, { rate: Math.min(100, Math.max(0, n)) })}
                    />
                  )}
                  <span className="acct-inv-line-amt" dir="ltr">
                    {fmtAmountEn(computed, { currency: false })}
                  </span>
                  <button type="button" className="acct-inv-icon-btn" title="حذف" onClick={() => props.onRemoveTax(tax.id)}>
                    <Trash2 className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="acct-inv-taxes-muted">لا ضرائب إضافية.</p>
        )}

        <div className="acct-inv-bottom">
          <div className="acct-inv-payment">
            <label>
              <span>الدفع</span>
              <select
                className="acct-inv-field"
                value={props.paymentMethod}
                onChange={(e) => props.onChange({ paymentMethod: e.target.value })}
              >
                {PAY_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="acct-inv-words-compact">
              <em>{amountInWordsFrDzd(props.math.ttc)}</em>
            </p>
            <p className="acct-inv-pay-foot">{payLabel}</p>
          </div>

          <div className="acct-inv-totals">
            <div className="acct-inv-total-line">
              <span>المجموع HT</span>
              <strong dir="ltr">{fmtAmountEn(props.math.ht)}</strong>
            </div>
            {props.math.discount > 0 ? (
              <div className="acct-inv-total-line">
                <span>الحسم</span>
                <strong dir="ltr">− {fmtAmountEn(props.math.discount)}</strong>
              </div>
            ) : null}
            <div className="acct-inv-total-line">
              <span>الصافي HT</span>
              <strong dir="ltr">{fmtAmountEn(props.math.net)}</strong>
            </div>
            {props.vatExempt ? (
              <div className="acct-inv-total-line">
                <span>TVA</span>
                <strong>معفى</strong>
              </div>
            ) : null}
            {props.math.taxLines.map((t) => (
              <div key={t.id} className="acct-inv-total-line">
                <span>{t.mode === 'amount' ? t.label : `${t.label} ${t.rate}%`}</span>
                <strong dir="ltr">{fmtAmountEn(t.amount)}</strong>
              </div>
            ))}
            <div className="acct-inv-total-line is-ttc">
              <span>الإجمالي TTC</span>
              <strong dir="ltr">{fmtAmountEn(props.math.ttc)}</strong>
            </div>
            {props.editing ? (
              <div className="acct-inv-total-line">
                <span>المتبقي</span>
                <strong dir="ltr">{fmtAmountEn(props.math.reste)}</strong>
              </div>
            ) : null}
          </div>
        </div>
      </article>
      </fieldset>

      {props.err ? <p className="acct-inv-window-error">{props.err}</p> : null}

      <div className="acct-inv-form-actions">
        <button type="button" className="acct-btn acct-btn-ghost" onClick={props.onClose}>
          إلغاء
        </button>
        {props.canPrint && props.onPrint ? (
          <AcctPrintButton label="معاينة / طباعة" disabled={props.busy} onClick={props.onPrint} />
        ) : null}
        {props.readOnly ? null : (
          <button type="submit" disabled={props.busy} className="acct-btn acct-btn-primary">
            حفظ
          </button>
        )}
      </div>
    </form>
  );
}

'use client';



import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { PAY_METHODS } from './money';

import { SupplierInvoiceForm } from './SupplierInvoiceModal';

import { type InvoiceDiscountKind } from '@/lib/algerian-invoice-decree';

import {

  computeSupplierInvoiceTotals,

  composeSupplierInvoiceNote,

  defaultInvoiceLine,

  defaultInvoiceTax,

  detailFromLegacyInvoice,

  parseSupplierInvoiceDetail,

  serializeSupplierInvoiceDetail,

  type SupplierInvoiceDetail,

  type SupplierInvoiceLine,

  type SupplierInvoiceTax,

} from '@/lib/supplier-invoice-document';



const todayISO = () => new Date().toISOString().slice(0, 10);



type SupplierRow = {

  id: string;

  name_ar: string;

  code?: string;

  contact?: string;

  payment_terms_days?: number;

};



type InvoiceRow = {

  id: string;

  invoice_no: string;

  invoice_date: string;

  due_date: string;

  amount: number;

  amount_ht?: number | null;

  discount?: number | null;

  tax_rate?: number | null;

  tax_amount?: number | null;

  paid_amount: number;

  status?: string;

  note?: string | null;

  detail_json?: string | null;

};



export default function SupplierInvoicePageClient() {

  const router = useRouter();

  const searchParams = useSearchParams();

  const supplierId = searchParams.get('supplier')?.trim() || '';

  const invoiceId = searchParams.get('invoice')?.trim() || '';



  const [supplier, setSupplier] = useState<SupplierRow | null>(null);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState('');

  const [readOnly, setReadOnly] = useState(false);

  const [savedInvoiceId, setSavedInvoiceId] = useState(invoiceId);



  const [invNo, setInvNo] = useState('');

  const [invDiscount, setInvDiscount] = useState(0);

  const [invPaid, setInvPaid] = useState(0);

  const [invDate, setInvDate] = useState(todayISO);

  const [invDue, setInvDue] = useState(todayISO);

  const [invDiscountKind, setInvDiscountKind] = useState<InvoiceDiscountKind>('none');

  const [invVatExempt, setInvVatExempt] = useState(false);

  const [invPayMethod, setInvPayMethod] = useState('BANK_TRANSFER');

  const [invSellerRc, setInvSellerRc] = useState('');

  const [invSellerNif, setInvSellerNif] = useState('');

  const [invBuyerRc, setInvBuyerRc] = useState('');

  const [invBuyerNif, setInvBuyerNif] = useState('');

  const [lines, setLines] = useState<SupplierInvoiceLine[]>(() => [defaultInvoiceLine({ unitPriceHt: 10000 })]);

  const [taxes, setTaxes] = useState<SupplierInvoiceTax[]>(() => [defaultInvoiceTax({ rate: 19 })]);



  useEffect(() => {

    setSavedInvoiceId(invoiceId);

  }, [invoiceId]);



  const returnUrl = useMemo(() => {

    const p = new URLSearchParams();

    p.set('tab', 'accountant');

    p.set('section', 'suppliers');

    return `/portal?${p.toString()}`;

  }, []);



  const goBack = useCallback(() => {

    router.push(returnUrl);

  }, [router, returnUrl]);



  const applyDetail = (detail: SupplierInvoiceDetail) => {

    setLines(detail.lines.length ? detail.lines : [defaultInvoiceLine()]);

    setTaxes(detail.taxes.length ? detail.taxes : [defaultInvoiceTax()]);

    setInvDiscountKind(detail.discountKind);

    setInvVatExempt(detail.vatExempt);

    setInvPayMethod(detail.paymentMethod || 'BANK_TRANSFER');

    setInvSellerRc(detail.sellerRc || '');

    setInvSellerNif(detail.sellerNif || '');

    setInvBuyerRc(detail.buyerRc || '');

    setInvBuyerNif(detail.buyerNif || '');

  };



  useEffect(() => {

    if (!supplierId) {

      setLoading(false);

      return;

    }

    let cancelled = false;

    setLoading(true);

    setErr('');

    fetch(`/api/finance/suppliers/${supplierId}`)

      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('تعذر تحميل المورد'))))

      .then((detail) => {

        if (cancelled) return;

        const s = detail.supplier || detail;

        setSupplier({

          id: s.id || supplierId,

          name_ar: s.name_ar || supplierId,

          code: s.code,

          contact: s.contact,

          payment_terms_days: s.payment_terms_days,

        });

        const invoices: InvoiceRow[] = detail.invoices || [];

        const today = todayISO();

        if (invoiceId) {

          const i = invoices.find((x) => x.id === invoiceId);

          if (!i) {

            setErr('الفاتورة غير موجودة');

            return;

          }

          setInvDiscount(Number(i.discount) || 0);

          setInvPaid(Number(i.paid_amount) || 0);

          setInvNo(i.invoice_no || '');

          setReadOnly(String(i.status || '').toUpperCase() === 'VOID');

          setInvDate(String(i.invoice_date || today).slice(0, 10));

          setInvDue(String(i.due_date || i.invoice_date || today).slice(0, 10));

          const parsed = parseSupplierInvoiceDetail(i.detail_json);

          applyDetail(

            parsed ||

              detailFromLegacyInvoice({

                amount_ht: i.amount_ht,

                discount: i.discount,

                tax_rate: i.tax_rate,

                note: i.note,

              })

          );

        } else {

          const terms = Number(s.payment_terms_days) || 0;

          const due = terms

            ? new Date(Date.now() + terms * 86400000).toISOString().slice(0, 10)

            : today;

          setInvDate(today);

          setInvDue(due);

          setReadOnly(false);

          setLines([defaultInvoiceLine({ unitPriceHt: 10000 })]);

          setTaxes([defaultInvoiceTax({ rate: 19 })]);

        }

      })

      .catch((e) => {

        if (!cancelled) setErr(e.message || 'خطأ');

      })

      .finally(() => {

        if (!cancelled) setLoading(false);

      });

    return () => {

      cancelled = true;

    };

  }, [supplierId, invoiceId]);



  const invoiceMath = useMemo(() => {

    const totals = computeSupplierInvoiceTotals({

      lines,

      discount: invDiscount,

      taxes,

      vatExempt: invVatExempt,

    });

    const reste = Math.max(0, Math.round((totals.ttc - (Number(invPaid) || 0)) * 100) / 100);

    return { ...totals, reste };

  }, [lines, invDiscount, taxes, invVatExempt, invPaid]);



  const buildDetail = (): SupplierInvoiceDetail => ({

    v: 1,

    kind: 'agency_copy',

    lines,

    taxes: invVatExempt ? taxes.map((t) => ({ ...t, rate: 0 })) : taxes,

    discountKind: invDiscountKind,

    paymentMethod: invPayMethod,

    vatExempt: invVatExempt,

    sellerRc: invSellerRc || undefined,

    sellerNif: invSellerNif || undefined,

    buyerRc: invBuyerRc || undefined,

    buyerNif: invBuyerNif || undefined,

  });



  const persist = async (opts?: { thenPrint?: boolean }) => {

    if (!supplierId) return;

    if (invoiceMath.ttc <= 0) {

      setErr('أدخل بنوداً بمبالغ صحيحة');

      return;

    }

    setBusy(true);

    setErr('');

    const detail = buildDetail();

    const payLabel = PAY_METHODS.find((m) => m.value === invPayMethod)?.label || invPayMethod;

    const note = composeSupplierInvoiceNote({

      detail,

      totals: invoiceMath,

      paymentMethodLabel: payLabel,

      dueDate: invDue,

    });

    const body = {

      invoice_no: invNo || undefined,

      amount_ht: invoiceMath.ht,

      discount: invoiceMath.discount,

      tax_rate: invoiceMath.taxRate,

      tax_amount: invoiceMath.tax,

      amount: invoiceMath.ttc,

      invoice_date: invDate,

      due_date: invDue,

      note,

      detail_json: serializeSupplierInvoiceDetail(detail),

    };

    const targetId = savedInvoiceId || invoiceId;

    try {

      const res = await fetch(`/api/finance/suppliers/${supplierId}/invoices`, {

        method: targetId ? 'PATCH' : 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(targetId ? { id: targetId, ...body } : body),

      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {

        setErr(data.error || 'تعذر حفظ الفاتورة');

        return;

      }

      const id = String(data.id || targetId || '');

      if (opts?.thenPrint && id) {

        router.push(

          `/portal/suppliers/invoice/print?supplier=${encodeURIComponent(supplierId)}&invoice=${encodeURIComponent(id)}&print=1`

        );

        return;

      }

      router.push(returnUrl);

    } catch {

      setErr('تعذر الاتصال بالخادم');

    } finally {

      setBusy(false);

    }

  };



  const submit = (e: React.FormEvent) => {

    e.preventDefault();

    void persist();

  };



  const openPrint = () => {

    const id = savedInvoiceId || invoiceId;

    if (id) {

      router.push(

        `/portal/suppliers/invoice/print?supplier=${encodeURIComponent(supplierId)}&invoice=${encodeURIComponent(id)}`

      );

      return;

    }

    void persist({ thenPrint: true });

  };



  const patchForm = (patch: Partial<{

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

  }>) => {

    if (patch.invoiceNo !== undefined) setInvNo(patch.invoiceNo);

    if (patch.invoiceDate !== undefined) setInvDate(patch.invoiceDate);

    if (patch.dueDate !== undefined) setInvDue(patch.dueDate);

    if (patch.discount !== undefined) setInvDiscount(patch.discount);

    if (patch.discountKind !== undefined) setInvDiscountKind(patch.discountKind);

    if (patch.vatExempt !== undefined) setInvVatExempt(patch.vatExempt);

    if (patch.paymentMethod !== undefined) setInvPayMethod(patch.paymentMethod);

    if (patch.sellerRc !== undefined) setInvSellerRc(patch.sellerRc);

    if (patch.sellerNif !== undefined) setInvSellerNif(patch.sellerNif);

    if (patch.buyerRc !== undefined) setInvBuyerRc(patch.buyerRc);

    if (patch.buyerNif !== undefined) setInvBuyerNif(patch.buyerNif);

  };



  if (!supplierId) {

    return (

      <div className="acct-inv-page" dir="rtl">

        <p className="acct-inv-page-empty">حدّد مورداً من قائمة الموردين.</p>

        <button type="button" className="acct-btn acct-btn-primary" onClick={() => router.push('/portal?tab=accountant&section=suppliers')}>

          العودة للموردين

        </button>

      </div>

    );

  }



  return (

    <div className="acct-inv-page" dir="rtl">

      <header className="acct-inv-page-top">

        <button type="button" className="acct-inv-page-back" onClick={goBack}>

          <ArrowRight className="w-4 h-4" aria-hidden />

          رجوع للمورد

        </button>

        <div className="acct-inv-page-head-text">

          <h1>{readOnly ? 'تفاصيل فاتورة ملغاة' : invoiceId ? 'تعديل الفاتورة' : 'فاتورة جديدة'}</h1>

          {supplier ? (

            <p className="acct-inv-page-supplier">

              {supplier.name_ar}

              {supplier.code ? <span className="font-mono opacity-60">{supplier.code}</span> : null}

            </p>

          ) : null}

        </div>

      </header>



      {loading ? (

        <p className="acct-inv-page-loading">جاري التحميل…</p>

      ) : (

        <main className="acct-inv-page-main">

          {err && !supplier ? <p className="acct-inv-page-error">{err}</p> : null}

          {supplier ? (

            <div className="acct-inv-page-sheet-wrap">

              <SupplierInvoiceForm

                editing={Boolean(invoiceId)}

                readOnly={readOnly}

                busy={busy}

                err={err}

                seller={{

                  name: supplier.name_ar,

                  code: supplier.code,

                  phone: supplier.contact || undefined,

                }}

                buyer={{ name: 'وكالة ساوث ستريت', address: 'الجزائر' }}

                invoiceNo={invNo}

                invoiceDate={invDate}

                dueDate={invDue}

                lines={lines}

                taxes={taxes}

                discount={invDiscount}

                discountKind={invDiscountKind}

                vatExempt={invVatExempt}

                paymentMethod={invPayMethod}

                math={invoiceMath}

                sellerRc={invSellerRc}

                sellerNif={invSellerNif}

                buyerRc={invBuyerRc}

                buyerNif={invBuyerNif}

                canPrint

                onClose={goBack}

                onSubmit={submit}

                onPrint={openPrint}

                onAddLine={() => setLines((prev) => [...prev, defaultInvoiceLine()])}

                onRemoveLine={(id) => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)))}

                onChangeLine={(id, patch) =>

                  setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))

                }

                onAddTax={() => setTaxes((prev) => [...prev, defaultInvoiceTax({ role: 'other', label: '', rate: 0, mode: 'percent' })])}

                onRemoveTax={(id) => setTaxes((prev) => prev.filter((t) => t.id !== id || t.role === 'tva'))}

                onChangeTax={(id, patch) =>

                  setTaxes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))

                }

                onChange={patchForm}

              />

            </div>

          ) : null}

        </main>

      )}

    </div>

  );

}


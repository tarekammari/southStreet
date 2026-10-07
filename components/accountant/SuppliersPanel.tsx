'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fmtCount, fmtMoney, PAY_METHODS } from './money';
import {
  supplierTotalsFromStatus,
  type SupplierStatusRow,
} from '@/lib/supplier-summary';
import type { SupplierRecapRollup } from '@/lib/finance';
import {
  DEFAULT_SUPPLIER_CATEGORY,
  SUPPLIER_CATEGORIES,
  SUPPLIER_LANES,
  supplierLane,
  normalizeSupplierCategory,
  supplierCategoryLabel,
  type SupplierCategoryId,
} from '@/lib/finance-categories';
import {
  Disclosure,
  FilterDrawer,
  Kpi as Stat,
  PanelHeader,
  PrimaryButton,
  SearchField,
} from './ui';
import ScfClass6AccountSelect from './ScfClass6AccountSelect';
import AcctPrintButton from './AcctPrintButton';
import { scfCodeForSupplierCategory } from '@/lib/scf-category-map';
import EntityAvatar, { EntityNameCell } from './EntityAvatar';
import { resolveSupplierImageUrl } from '@/lib/entity-avatar-display';

type Supplier = {
  id: string;
  code: string;
  name_ar: string;
  contact: string;
  payment_terms_days: number;
  status: string;
  category?: string | null;
  scf_code?: string | null;
  image_url?: string | null;
};
type Settlement = 'PAID_FULL' | 'OVERDUE' | 'DUE_SOON' | 'OPEN' | 'NO_INVOICES';
type Aging = {
  supplier_id: string;
  name_ar: string;
  total_remaining: number;
  category?: string | null;
  payment_terms_days: number;
  bucket_current: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  overdue_amount: number;
  open_count: number;
  oldest_due_date: string | null;
  oldest_overdue_days: number;
  next_due_date: string | null;
  days_to_next_due: number | null;
  invoice_count: number;
  total_invoiced: number;
  total_paid: number;
  paid_ratio: number;
  settlement: Settlement;
};

/** How a supplier stands against its agreed payment terms. */
const SETTLEMENT_TAG: Record<Settlement, { text: string; cls: string } | null> = {
  PAID_FULL: { text: 'خالص بالكامل', cls: 'acct-tag-ok' },
  OVERDUE: { text: 'متأخر', cls: 'acct-tag-late' },
  DUE_SOON: { text: 'يستحق قريباً', cls: 'acct-tag-warn' },
  OPEN: null,
  NO_INVOICES: { text: 'بدون فواتير', cls: 'acct-tag-neutral' },
};
  type Invoice = {
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
  remaining: number;
  status: string;
  note?: string;
};
type Payment = {
  id: string;
  invoice_id: string | null;
  amount: number;
  method: string;
  payment_date: string;
  note?: string;
  status?: string;
};
type StatementLine = {
  id: string;
  kind: 'INVOICE' | 'PAYMENT';
  date: string;
  ref: string;
  label: string;
  debit: number;
  credit: number;
  balance: number;
  status?: string;
  due_date?: string | null;
  method?: string | null;
};
type StatementTotals = {
  total_invoiced: number;
  total_paid: number;
  balance: number;
  open_count: number;
  overdue_count: number;
  overdue_amount: number;
  oldest_overdue_days: number;
  next_due_date: string | null;
  avg_settlement_days: number | null;
  last_payment_date: string | null;
};
type DebtSummary = {
  total_invoiced?: number;
  total_paid?: number;
  total_debt: number;
  total_unpaid?: number;
  open_debt: number;
  partial_debt: number;
  open_invoices: number;
};
type DrawerTab = 'statement' | 'invoices' | 'payments';

const CAT_FILTER_KEY = 'southstreet.acct.supplierCat';
const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: 'statement', label: 'كشف الحساب' },
  { id: 'invoices', label: 'الفواتير' },
  { id: 'payments', label: 'الدفعات' },
];

const emptyAging = (id: string, name: string): Aging => ({
  supplier_id: id,
  name_ar: name,
  total_remaining: 0,
  payment_terms_days: 0,
  bucket_current: 0,
  bucket_1_30: 0,
  bucket_31_60: 0,
  bucket_61_90: 0,
  bucket_90_plus: 0,
  overdue_amount: 0,
  open_count: 0,
  oldest_due_date: null,
  oldest_overdue_days: 0,
  next_due_date: null,
  days_to_next_due: null,
  invoice_count: 0,
  total_invoiced: 0,
  total_paid: 0,
  paid_ratio: 0,
  settlement: 'NO_INVOICES',
});

/** One-line read on the supplier's payment terms, shown under the name. */
function termNote(a: Aging) {
  if (a.invoice_count === 0) return 'لا فواتير مسجّلة';
  if (a.settlement === 'PAID_FULL') {
    return `خالص · ${a.invoice_count} فاتورة بقيمة ${fmtMoney(a.total_invoiced)}`;
  }
  if (a.settlement === 'OVERDUE') {
    return `تأخّر ${a.oldest_overdue_days} يوم · متأخر ${fmtMoney(a.overdue_amount)}`;
  }
  if (a.days_to_next_due != null) {
    const when =
      a.days_to_next_due === 0
        ? 'يستحق اليوم'
        : a.days_to_next_due === 1
          ? 'يستحق غداً'
          : `يستحق بعد ${a.days_to_next_due} يوم`;
    return `${when} (${a.next_due_date}) · ${a.open_count} فاتورة مفتوحة`;
  }
  return `${a.open_count} فاتورة مفتوحة · مدة السداد ${a.payment_terms_days} يوم`;
}

function statusLabel(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'ACTIVE' || s === 'نشط') return { text: 'نشط', cls: 'bg-emerald-500/15 text-emerald-700' };
  if (s === 'INACTIVE' || s === 'موقوف') return { text: 'موقوف', cls: 'bg-slate-500/15 opacity-80' };
  return { text: status || '—', cls: 'bg-amber-500/15 text-amber-800' };
}

function invoiceStatusLabel(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'PAID') return { text: 'مسددة', cls: 'text-emerald-700' };
  if (s === 'PARTIAL') return { text: 'جزئية', cls: 'text-amber-700' };
  if (s === 'VOID') return { text: 'ملغاة', cls: 'opacity-50 line-through' };
  return { text: 'مفتوحة', cls: 'text-sky-700' };
}

function methodLabel(raw?: string | null) {
  return PAY_METHODS.find((m) => m.value === String(raw || '').toUpperCase())?.label || raw || '—';
}

const todayISO = () => new Date().toISOString().slice(0, 10);

type SupplierKpiDrill = 'invoiced' | 'paid' | 'unpaid' | 'overdue' | 'due_soon' | 'settled';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const defaultPeriodFrom = () => isoDay(new Date(new Date().getFullYear(), 0, 1));
const defaultPeriodTo = () => isoDay(new Date());

export default function SuppliersPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recapFrom = searchParams.get('from')?.slice(0, 10) || defaultPeriodFrom();
  const recapTo = searchParams.get('to')?.slice(0, 10) || defaultPeriodTo();
  const lane = SUPPLIER_LANES.find((l) => l.id === (searchParams.get('lane') || '')) || null;

  const setRecapPeriod = useCallback(
    (nextFrom: string, nextTo: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'accountant');
      params.set('section', 'suppliers');
      if (nextFrom) params.set('from', nextFrom);
      else params.delete('from');
      if (nextTo) params.set('to', nextTo);
      else params.delete('to');
      router.replace(`/portal?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const [items, setItems] = useState<Supplier[]>([]);
  const [aging, setAging] = useState<Aging[]>([]);
  const [kpiDrill, setKpiDrill] = useState<SupplierKpiDrill | null>(null);
  const [debt, setDebt] = useState<DebtSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('statement');
  const [invoiceListFilter, setInvoiceListFilter] = useState<'all' | 'open' | 'void'>('all');
  const [payListFilter, setPayListFilter] = useState<'live' | 'void'>('live');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statement, setStatement] = useState<StatementLine[]>([]);
  const [totals, setTotals] = useState<StatementTotals | null>(null);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [termFilter, setTermFilter] = useState<'all' | 'NO_INVOICES' | 'PAID_FULL' | 'DUE_SOON' | 'OVERDUE'>('all');
  const [payOpen, setPayOpen] = useState(false);
  const [editingPayId, setEditingPayId] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [amount, setAmount] = useState(10000);
  const [method, setMethod] = useState('CASH');
  const [invoiceId, setInvoiceId] = useState('');
  const [payDate, setPayDate] = useState(todayISO);
  const [payNote, setPayNote] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [newCategory, setNewCategory] = useState<SupplierCategoryId>(DEFAULT_SUPPLIER_CATEGORY);
  const [newScfCode, setNewScfCode] = useState(() => scfCodeForSupplierCategory(DEFAULT_SUPPLIER_CATEGORY));
  const [editForm, setEditForm] = useState({
    name_ar: '',
    code: '',
    contact: '',
    payment_terms_days: 30,
    status: 'ACTIVE',
    category: DEFAULT_SUPPLIER_CATEGORY as string,
    scf_code: scfCodeForSupplierCategory(DEFAULT_SUPPLIER_CATEGORY),
    image_url: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [recapReady, setRecapReady] = useState(false);
  const [recapRollups, setRecapRollups] = useState<SupplierRecapRollup[]>([]);
  const [recapTotals, setRecapTotals] = useState<{
    period_invoices: number;
    period_services: number;
    period_result_amount: number;
  } | null>(null);

  useEffect(() => {
    try {
      const c = sessionStorage.getItem(CAT_FILTER_KEY);
      if (c) setCatFilter(c);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!lane) return;
    setNewCategory(lane.defaultCategory);
    setNewScfCode(lane.id === 'investment' ? '21' : scfCodeForSupplierCategory(lane.defaultCategory));
    setCatFilter('all');
  }, [lane]);

  useEffect(() => {
    const sid = searchParams.get('supplier');
    const focus = searchParams.get('focus');
    if (!sid && !focus) return;
    const p = new URLSearchParams(searchParams.toString());
    p.delete('supplier');
    p.delete('focus');
    const q = p.toString();
    router.replace(q ? `/portal?${q}` : '/portal', { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CAT_FILTER_KEY, catFilter);
    } catch {
      /* ignore */
    }
  }, [catFilter]);

  const load = useCallback(() => {
    fetch('/api/finance/suppliers')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
    fetch('/api/finance/suppliers/aging')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setAging(d.items || []))
      .catch(() => setAging([]));
    fetch('/api/finance/suppliers/debt-summary')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setDebt(d))
      .catch(() => setDebt(null));
    setRecapReady(false);
    fetch(
      `/api/finance/suppliers/recap-rollups?from=${encodeURIComponent(recapFrom)}&to=${encodeURIComponent(recapTo)}`
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setRecapRollups(d.items || []);
        setRecapTotals(d.totals || null);
      })
      .catch(() => {
        setRecapRollups([]);
        setRecapTotals(null);
      })
      .finally(() => setRecapReady(true));
  }, [recapFrom, recapTo]);

  useEffect(() => {
    load();
  }, [load]);

  const recapBySupplier = useMemo(
    () => new Map(recapRollups.map((r) => [r.supplier_id, r])),
    [recapRollups]
  );

  const [detailVersion, setDetailVersion] = useState(0);
  const refreshDetail = () => setDetailVersion((v) => v + 1);

  useEffect(() => {
    if (!selected || !drawerOpen) {
      setInvoices([]);
      setPayments([]);
      setStatement([]);
      setTotals(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetch(`/api/finance/suppliers/${selected}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`/api/finance/suppliers/${selected}/statement`).then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([detail, stmt]) => {
        if (cancelled) return;
        setInvoices(detail.invoices || []);
        setPayments(detail.payments || []);
        setStatement(stmt.lines || []);
        setTotals(stmt.totals || null);
      })
      .catch(() => {
        if (cancelled) return;
        setInvoices([]);
        setPayments([]);
        setStatement([]);
        setTotals(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, drawerOpen, detailVersion]);

  const agingMap = useMemo(() => {
    const m = new Map<string, Aging>();
    aging.forEach((a) => m.set(a.supplier_id, a));
    return m;
  }, [aging]);

  const scopedItems = useMemo(
    () => (lane ? items.filter((s) => supplierLane(s) === lane.id) : items),
    [items, lane]
  );

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: scopedItems.length };
    for (const c of SUPPLIER_CATEGORIES) counts[c.id] = 0;
    for (const s of scopedItems) {
      const id = normalizeSupplierCategory(s.category);
      counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [scopedItems]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((s) => {
        if (lane && supplierLane(s) !== lane.id) return false;
        const cat = normalizeSupplierCategory(s.category);
        if (catFilter !== 'all' && cat !== catFilter) return false;
        if (!needle) return true;
        return (
          s.code.toLowerCase().includes(needle) ||
          s.name_ar.toLowerCase().includes(needle) ||
          (s.contact || '').toLowerCase().includes(needle) ||
          supplierCategoryLabel(s.category).includes(needle)
        );
      })
      .map((s) => ({
        supplier: s,
        aging: agingMap.get(s.id) || emptyAging(s.id, s.name_ar),
      }))
      .filter(({ aging: a }) => {
        if (termFilter === 'all') return true;
        return a.settlement === termFilter;
      })
      // Overdue first, then what falls due soonest, then by size of the balance.
      .sort((a, b) => {
        const rank = (x: Aging) =>
          x.settlement === 'OVERDUE' ? 0 : x.settlement === 'DUE_SOON' ? 1 : x.total_remaining > 0 ? 2 : 3;
        return (
          rank(a.aging) - rank(b.aging) ||
          b.aging.overdue_amount - a.aging.overdue_amount ||
          b.aging.total_remaining - a.aging.total_remaining
        );
      });
  }, [items, agingMap, q, catFilter, termFilter, lane]);

  const statusRows = useMemo(() => {
    if (!lane) return aging as SupplierStatusRow[];
    const ids = new Set(scopedItems.map((s) => s.id));
    return aging.filter((a) => ids.has(a.supplier_id)) as SupplierStatusRow[];
  }, [aging, lane, scopedItems]);

  const hasRecapRollups = recapRollups.length > 0 && recapTotals != null;

  const kpis = useMemo(() => {
    const fromStatus = supplierTotalsFromStatus(statusRows);
    const globalBook = !lane;
    return {
      totalInvoiced:
        globalBook && recapTotals != null
          ? recapTotals.period_result_amount
          : Number(globalBook ? debt?.total_invoiced ?? fromStatus.totalInvoiced : fromStatus.totalInvoiced) || 0,
      totalPaid: Number(globalBook ? debt?.total_paid ?? fromStatus.totalPaid : fromStatus.totalPaid) || 0,
      totalUnpaid:
        Number(
          globalBook
            ? debt?.total_unpaid ?? debt?.total_debt ?? fromStatus.totalUnpaid
            : fromStatus.totalUnpaid
        ) || 0,
      overdue: fromStatus.overdue,
      dueSoon: fromStatus.dueSoon,
      settledCount: fromStatus.settledCount,
      openInvoices: Number(globalBook ? debt?.open_invoices ?? fromStatus.openInvoices : fromStatus.openInvoices) || 0,
    };
  }, [debt, statusRows, recapTotals, lane]);

  /** Mوردون بعد البحث والفلاتر — تُستخدم في جداول ملخص الذمم. */
  const filteredAging = useMemo(() => rows.map((r) => r.aging), [rows]);

  /** دليل كامل — يشمل الموردين بلا فواتير (قابل للنقر لإضافة حركة). */
  const directoryRows = useMemo((): SupplierStatusRow[] => {
    const base = rows.map(({ supplier, aging: a }) => ({
      supplier_id: supplier.id,
      name_ar: a.name_ar || supplier.name_ar,
      category: supplier.category,
      total_remaining: a.total_remaining,
      total_invoiced: a.total_invoiced,
      total_paid: a.total_paid,
      overdue_amount: a.overdue_amount,
      open_count: a.open_count,
      invoice_count: a.invoice_count,
      settlement: a.settlement,
    }));
    const inPeriod = recapReady
      ? base.filter((r) => recapBySupplier.has(r.supplier_id))
      : [];
    if (hasRecapRollups) {
      return [...inPeriod].sort(
        (a, b) =>
          (recapBySupplier.get(b.supplier_id)?.period_result_amount || 0) -
          (recapBySupplier.get(a.supplier_id)?.period_result_amount || 0)
      );
    }
    return inPeriod;
  }, [rows, hasRecapRollups, recapBySupplier, recapReady]);

  /** إجمالي المفوتر — every fournisseur with P&L in period (فواتير + 613), same as الملخص. */
  const invoicedDrillRows = useMemo((): SupplierStatusRow[] => {
    if (hasRecapRollups) {
      return recapRollups
        .filter((r) => r.period_result_amount > 0)
        .sort((a, b) => b.period_result_amount - a.period_result_amount)
        .map((r) => {
          const sup = items.find((s) => s.id === r.supplier_id);
          const a = agingMap.get(r.supplier_id);
          return {
            supplier_id: r.supplier_id,
            name_ar: a?.name_ar || sup?.name_ar || r.supplier_id,
            category: sup?.category ?? a?.category,
            total_remaining: a?.total_remaining ?? 0,
            total_invoiced: a?.total_invoiced ?? r.period_invoices,
            total_paid: a?.total_paid ?? 0,
            overdue_amount: a?.overdue_amount ?? 0,
            open_count: a?.open_count ?? 0,
            invoice_count: a?.invoice_count ?? 0,
            settlement: a?.settlement ?? 'NO_INVOICES',
          };
        });
    }
    return filteredAging
      .filter((a) => (a.total_invoiced || 0) > 0)
      .sort((a, b) => b.total_invoiced - a.total_invoiced)
      .map((a) => ({
        supplier_id: a.supplier_id,
        name_ar: a.name_ar,
        category: a.category,
        total_remaining: a.total_remaining,
        total_invoiced: a.total_invoiced,
        total_paid: a.total_paid,
        overdue_amount: a.overdue_amount,
        open_count: a.open_count,
        invoice_count: a.invoice_count,
        settlement: a.settlement,
      }));
  }, [hasRecapRollups, recapRollups, items, agingMap, filteredAging]);

  const invoicedSuppliers = useMemo(
    () =>
      [...filteredAging]
        .filter((a) => (a.total_invoiced || 0) > 0)
        .sort((a, b) => b.total_invoiced - a.total_invoiced),
    [filteredAging],
  );

  const paidSuppliers = useMemo(
    () =>
      [...filteredAging]
        .filter((a) => (a.total_paid || 0) > 0)
        .sort((a, b) => b.total_paid - a.total_paid),
    [filteredAging],
  );

  const unpaidSuppliers = useMemo(
    () =>
      [...filteredAging]
        .filter((a) => (a.total_remaining || 0) > 0)
        .sort((a, b) => b.total_remaining - a.total_remaining),
    [filteredAging],
  );

  const overdueSuppliers = useMemo(
    () =>
      [...filteredAging]
        .filter((a) => (a.overdue_amount || 0) > 0)
        .sort((a, b) => b.overdue_amount - a.overdue_amount),
    [filteredAging],
  );

  const dueSoonSuppliers = useMemo(
    () =>
      [...filteredAging]
        .filter((a) => a.settlement === 'DUE_SOON')
        .sort((a, b) => b.total_remaining - a.total_remaining),
    [filteredAging],
  );

  const settledSuppliers = useMemo(
    () =>
      [...filteredAging]
        .filter((a) => a.settlement === 'PAID_FULL')
        .sort((a, b) => b.total_invoiced - a.total_invoiced),
    [filteredAging],
  );

  const toggleDrill = (id: SupplierKpiDrill) => {
    setKpiDrill((d) => (d === id ? null : id));
  };

  /** Headline counts for the payment-term segments. */
  const termCounts = useMemo(() => {
    const ids = new Set(scopedItems.map((s) => s.id));
    const scopedAging = aging.filter((a) => ids.has(a.supplier_id));
    const count = (s: Settlement) => scopedAging.filter((a) => a.settlement === s).length;
    return {
      all: scopedItems.length,
      NO_INVOICES: count('NO_INVOICES'),
      PAID_FULL: count('PAID_FULL'),
      DUE_SOON: count('DUE_SOON'),
      OVERDUE: count('OVERDUE'),
      dueSoonAmount: scopedAging
        .filter((a) => a.settlement === 'DUE_SOON')
        .reduce((s, a) => s + a.total_remaining, 0),
    };
  }, [aging, scopedItems]);

  const selectedSupplier = items.find((s) => s.id === selected) || null;
  const selectedAging =
    (selected && agingMap.get(selected)) ||
    (selectedSupplier ? emptyAging(selectedSupplier.id, selectedSupplier.name_ar) : null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setPayOpen(false);
    setEditOpen(false);
    setSelected(null);
    setErr('');
  }, []);

  const openSupplier = (id: string) => {
    setSelected(id);
    setDrawerOpen(true);
    setDrawerTab('statement');
    setInvoiceListFilter('all');
    setPayListFilter('live');
    setPayOpen(false);
    setEditOpen(false);
    setErr('');
  };

  const goDrawerDetail = (tab: DrawerTab, invoiceFilter: 'all' | 'open' | 'void' = 'all') => {
    setDrawerTab(tab);
    setInvoiceListFilter(invoiceFilter);
  };

  const drawerInvoices = useMemo(() => {
    if (invoiceListFilter === 'void') return invoices.filter((i) => i.status === 'VOID');
    if (invoiceListFilter === 'open') {
      return invoices.filter((i) => i.status !== 'PAID' && i.status !== 'VOID');
    }
    return invoices.filter((i) => i.status !== 'VOID');
  }, [invoices, invoiceListFilter]);

  const drawerInvoiceTotals = useMemo(
    () =>
      drawerInvoices.reduce(
        (acc, i) => {
          acc.amount += Number(i.amount) || 0;
          acc.remaining += Number(i.remaining) || 0;
          return acc;
        },
        { amount: 0, remaining: 0 }
      ),
    [drawerInvoices]
  );

  const livePayments = useMemo(
    () => payments.filter((p) => String(p.status || 'POSTED').toUpperCase() !== 'VOID'),
    [payments]
  );
  const voidPayments = useMemo(
    () => payments.filter((p) => String(p.status || '').toUpperCase() === 'VOID'),
    [payments]
  );
  const shownPayments = payListFilter === 'void' ? voidPayments : livePayments;
  const paymentTotal = useMemo(
    () => livePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [livePayments]
  );

  const statementTotalsRow = useMemo(() => {
    if (statement.length === 0) return null;
    const debit = statement.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = statement.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    const balance = statement[statement.length - 1]?.balance ?? debit - credit;
    return { debit, credit, balance };
  }, [statement]);

  const supplierById = useMemo(() => new Map(items.map((s) => [s.id, s])), [items]);

  const supplierPhoto = (supplierId: string, name: string, category?: string | null) => {
    const row = supplierById.get(supplierId);
    return resolveSupplierImageUrl({
      image_url: row?.image_url,
      name_ar: row?.name_ar || name,
      category: row?.category ?? category,
    });
  };

  const computeDrillColumnTotals = (
    list: SupplierStatusRow[],
    opts?: { showOverdue?: boolean; showSettledOnly?: boolean },
    useRecap?: boolean
  ) => {
    const t = {
      period_result: 0,
      period_invoices: 0,
      period_services: 0,
      remaining401: 0,
      invoiced: 0,
      paid: 0,
      remaining: 0,
      overdue: 0,
      open_count: 0,
    };
    for (const r of list) {
      const recap = recapBySupplier.get(r.supplier_id);
      if (opts?.showSettledOnly) {
        t.invoiced += r.total_invoiced || 0;
        t.paid += r.total_paid || 0;
      } else if (useRecap) {
        t.period_result += recap?.period_result_amount || 0;
        t.period_invoices += recap?.period_invoices || 0;
        t.period_services += recap?.period_services || 0;
        t.remaining401 += r.total_remaining || 0;
      } else {
        t.invoiced += r.total_invoiced || 0;
        t.paid += r.total_paid || 0;
        t.remaining += r.total_remaining || 0;
        if (opts?.showOverdue) t.overdue += r.overdue_amount || 0;
        t.open_count += r.open_count || 0;
      }
    }
    return t;
  };

  const supplierDrillTable = (
    list: SupplierStatusRow[],
    opts?: { showOverdue?: boolean; showSettledOnly?: boolean },
  ) => {
    const useRecap = hasRecapRollups;
    const colTotals = list.length > 0 ? computeDrillColumnTotals(list, opts, useRecap) : null;
    const colSpan = opts?.showSettledOnly
      ? 4
      : useRecap
        ? opts?.showOverdue
          ? 8
          : 7
        : opts?.showOverdue
          ? 7
          : 6;
    return (
      <table className="acct-kpi-detail-table">
        <thead>
          <tr>
            <th>المورد</th>
            <th>التصنيف</th>
            {!opts?.showSettledOnly ? (
              <>
                {useRecap ? (
                  <>
                    <th className="acct-num">في النتيجة</th>
                    <th className="acct-num">فواتير</th>
                    <th className="acct-num">613</th>
                  </>
                ) : null}
                <th className="acct-num">{useRecap ? '401 متبقٍ' : 'مفوتر'}</th>
                {!useRecap ? <th className="acct-num">مدفوع</th> : null}
                {!useRecap ? <th className="acct-num">متبقٍ</th> : null}
                {opts?.showOverdue ? <th className="acct-num">متأخر</th> : null}
                {!useRecap ? <th className="acct-num">فواتير</th> : null}
              </>
            ) : (
              <>
                <th className="acct-num">مفوتر</th>
                <th className="acct-num">مدفوع</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const recap = recapBySupplier.get(r.supplier_id);
            return (
              <tr
                key={r.supplier_id}
                className="acct-kpi-detail-row-btn"
                onClick={() => openSupplier(r.supplier_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openSupplier(r.supplier_id);
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <td>
                  <EntityNameCell
                    name={r.name_ar}
                    imageUrl={supplierPhoto(r.supplier_id, r.name_ar, r.category)}
                    category={r.category}
                    meta={
                      SETTLEMENT_TAG[r.settlement as Settlement]?.text ? (
                        <span
                          className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${SETTLEMENT_TAG[r.settlement as Settlement]?.cls || ''}`}
                        >
                          {SETTLEMENT_TAG[r.settlement as Settlement]?.text}
                        </span>
                      ) : null
                    }
                  />
                </td>
                <td className="text-xs opacity-80">{supplierCategoryLabel(r.category)}</td>
                {!opts?.showSettledOnly ? (
                  <>
                    {useRecap ? (
                      <>
                        <td className="acct-num font-bold">{fmtMoney(recap?.period_result_amount || 0)}</td>
                        <td className="acct-num">{fmtMoney(recap?.period_invoices || 0)}</td>
                        <td className="acct-num">{fmtMoney(recap?.period_services || 0)}</td>
                      </>
                    ) : null}
                    <td className="acct-num">{fmtMoney(useRecap ? r.total_remaining : r.total_invoiced)}</td>
                    {!useRecap ? (
                      <td className="acct-num text-emerald-700">{fmtMoney(r.total_paid)}</td>
                    ) : null}
                    {!useRecap ? (
                      <td className="acct-num font-bold text-amber-700">{fmtMoney(r.total_remaining)}</td>
                    ) : null}
                    {opts?.showOverdue ? (
                      <td className="acct-num font-bold text-rose-600">{fmtMoney(r.overdue_amount)}</td>
                    ) : null}
                    {!useRecap ? <td className="acct-num text-xs">{fmtCount(r.open_count)}</td> : null}
                  </>
                ) : (
                  <>
                    <td className="acct-num">{fmtMoney(r.total_invoiced)}</td>
                    <td className="acct-num text-emerald-700">{fmtMoney(r.total_paid)}</td>
                  </>
                )}
              </tr>
            );
          })}
          {list.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="opacity-60">
                لا موردين مطابقين
              </td>
            </tr>
          ) : null}
        </tbody>
        {colTotals ? (
          <tfoot>
            <tr className="acct-kpi-detail-total">
              <td colSpan={2} className="font-black">
                الإجمالي
              </td>
              {!opts?.showSettledOnly ? (
                <>
                  {useRecap ? (
                    <>
                      <td className="acct-num font-black">{fmtMoney(colTotals.period_result)}</td>
                      <td className="acct-num font-black">{fmtMoney(colTotals.period_invoices)}</td>
                      <td className="acct-num font-black">{fmtMoney(colTotals.period_services)}</td>
                    </>
                  ) : null}
                  <td className="acct-num font-black">
                    {fmtMoney(useRecap ? colTotals.remaining401 : colTotals.invoiced)}
                  </td>
                  {!useRecap ? (
                    <td className="acct-num font-black text-emerald-700">{fmtMoney(colTotals.paid)}</td>
                  ) : null}
                  {!useRecap ? (
                    <td className="acct-num font-black text-amber-700">{fmtMoney(colTotals.remaining)}</td>
                  ) : null}
                  {opts?.showOverdue ? (
                    <td className="acct-num font-black text-rose-600">{fmtMoney(colTotals.overdue)}</td>
                  ) : null}
                  {!useRecap ? (
                    <td className="acct-num font-black text-xs">{fmtCount(colTotals.open_count)}</td>
                  ) : null}
                </>
              ) : (
                <>
                  <td className="acct-num font-black">{fmtMoney(colTotals.invoiced)}</td>
                  <td className="acct-num font-black text-emerald-700">{fmtMoney(colTotals.paid)}</td>
                </>
              )}
            </tr>
          </tfoot>
        ) : null}
      </table>
    );
  };

  const openEdit = () => {
    if (!selectedSupplier) return;
    const cat = normalizeSupplierCategory(selectedSupplier.category);
    setEditForm({
      name_ar: selectedSupplier.name_ar || '',
      code: selectedSupplier.code || '',
      contact: selectedSupplier.contact || '',
      payment_terms_days: Number(selectedSupplier.payment_terms_days) || 30,
      status: String(selectedSupplier.status || 'ACTIVE').toUpperCase(),
      category: cat,
      scf_code:
        String(selectedSupplier.scf_code || '').trim() || scfCodeForSupplierCategory(cat),
      image_url: String(selectedSupplier.image_url || '').trim(),
    });
    setEditOpen(true);
  };

  const uploadSupplierImage = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/finance/upload-image', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'تعذّر رفع الصورة');
    setEditForm((f) => ({ ...f, image_url: String(data.url || '') }));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (addOpen) return setAddOpen(false);
      if (editOpen) return setEditOpen(false);
      if (payOpen) return setPayOpen(false);
      if (drawerOpen) closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addOpen, editOpen, payOpen, drawerOpen, closeDrawer]);

  const submit = async (url: string, init: RequestInit, onOk: (data?: Record<string, unknown>) => void) => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'تعذّر تنفيذ العملية');
        return;
      }
      onOk(data as Record<string, unknown>);
      load();
      refreshDetail();
    } catch {
      setErr('تعذّر الاتصال بالخادم');
    } finally {
      setBusy(false);
    }
  };

  const addSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    void submit(
      '/api/finance/suppliers',
      {
        method: 'POST',
        body: JSON.stringify({ name_ar: nameAr, category: newCategory, scf_code: newScfCode }),
      },
      (created) => {
        setAddOpen(false);
        setNameAr('');
        setNewCategory(DEFAULT_SUPPLIER_CATEGORY);
        setNewScfCode(scfCodeForSupplierCategory(DEFAULT_SUPPLIER_CATEGORY));
        const id = typeof created?.id === 'string' ? created.id : '';
        if (id) {
          setTimeout(() => openSupplier(id), 0);
        }
      }
    );
  };

  const saveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    void submit(
      `/api/finance/suppliers/${selected}`,
      { method: 'PATCH', body: JSON.stringify(editForm) },
      () => setEditOpen(false)
    );
  };

  const openNewPayment = () => {
    setEditingPayId('');
    setAmount(10000);
    setMethod('CASH');
    setInvoiceId('');
    setPayDate(todayISO());
    setPayNote('');
    setPayOpen(true);
  };

  const openEditPayment = (p: Payment) => {
    setEditingPayId(p.id);
    setAmount(Number(p.amount) || 0);
    setMethod(String(p.method || 'CASH').toUpperCase());
    setInvoiceId(p.invoice_id || '');
    setPayDate(String(p.payment_date || todayISO()).slice(0, 10));
    setPayNote(p.note || '');
    setPayOpen(true);
  };

  const openNewInvoice = () => {
    if (!selected) return;
    router.push(`/portal/suppliers/invoice?supplier=${encodeURIComponent(selected)}`);
  };

  const openEditInvoice = (i: Invoice) => {
    if (!selected) return;
    router.push(
      `/portal/suppliers/invoice?supplier=${encodeURIComponent(selected)}&invoice=${encodeURIComponent(i.id)}`
    );
  };

  const pay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const body = {
      amount,
      method,
      invoice_id: invoiceId || null,
      payment_date: payDate,
      note: payNote,
    };
    void submit(
      `/api/finance/suppliers/${selected}/payments`,
      editingPayId
        ? { method: 'PATCH', body: JSON.stringify({ id: editingPayId, ...body }) }
        : { method: 'POST', body: JSON.stringify(body) },
      () => {
        setPayOpen(false);
        setEditingPayId('');
        setInvoiceId('');
        setPayNote('');
      }
    );
  };

  const deletePayment = (paymentId: string) => {
    if (!selected) return;
    if (!window.confirm('إلغاء هذه الدفعة؟ تُسحب من الرصيد ويمكن عرضها لاحقاً من «الملغاة».')) return;
    void submit(
      `/api/finance/suppliers/${selected}/payments?id=${encodeURIComponent(paymentId)}`,
      { method: 'DELETE' },
      () => undefined
    );
  };

  const voidInvoice = (id: string) => {
    if (!selected) return;
    void submit(
      `/api/finance/suppliers/${selected}/invoices`,
      { method: 'PATCH', body: JSON.stringify({ id, action: 'void' }) },
      () => undefined
    );
  };

  const exportStatement = () => {
    if (!selectedSupplier || statement.length === 0) return;
    const header = ['التاريخ', 'المرجع', 'البيان', 'مدين', 'دائن', 'الرصيد'];
    const body = statement.map((l) => [l.date, l.ref, l.label, l.debit || '', l.credit || '', l.balance]);
    const csv = [header, ...body]
      .map((cells) => cells.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement-${selectedSupplier.code || selectedSupplier.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openInvoices = invoices.filter((i) => i.status !== 'PAID' && i.status !== 'VOID');
  const linkableInvoices = useMemo(
    () => invoices.filter((i) => i.status !== 'VOID'),
    [invoices]
  );

  const supplierFilterCount =
    (termFilter !== 'all' ? 1 : 0) + (catFilter !== 'all' ? 1 : 0) + (q.trim() ? 1 : 0);

  return (
    <div className="acct-suppliers">
      <PanelHeader
        compact
        title="الموردون"
        action={
          <div className="flex flex-wrap gap-2">
            <AcctPrintButton
              onClick={() => {
                const q = new URLSearchParams({ from: recapFrom, to: recapTo });
                if (lane?.id) q.set('lane', lane.id);
                router.push(`/portal/suppliers/print?${q.toString()}`);
              }}
            />
            <PrimaryButton onClick={() => setAddOpen(true)}>مورد جديد</PrimaryButton>
          </div>
        }
      />

      <section className="acct-supplier-board" aria-label="دليل الموردين">
        <div className="acct-supplier-board-bar">
          <div className="acct-supplier-board-title">
            <h3>دليل الموردين</h3>
            <span className="acct-supplier-board-count">{directoryRows.length}</span>
          </div>
          <div className="acct-supplier-board-tools">
            <SearchField value={q} onChange={setQ} placeholder="بحث بالرمز أو الاسم…" aria-label="بحث الموردين" />
      <FilterDrawer
        period={
          <div className="acct-filter-period-dates">
            <label className="acct-filter-period-field">
              <span className="sr-only">من</span>
              <input
                type="date"
                className="acct-input acct-filter-date"
                value={recapFrom}
                aria-label="من تاريخ"
                onChange={(e) => setRecapPeriod(e.target.value, recapTo)}
              />
            </label>
            <span className="acct-filter-period-sep" aria-hidden>
              →
            </span>
            <label className="acct-filter-period-field">
              <span className="sr-only">إلى</span>
              <input
                type="date"
                className="acct-input acct-filter-date"
                value={recapTo}
                aria-label="إلى تاريخ"
                onChange={(e) => setRecapPeriod(recapFrom, e.target.value)}
              />
            </label>
          </div>
        }
        activeCount={supplierFilterCount}
        onClear={
          supplierFilterCount
            ? () => {
                setTermFilter('all');
                setCatFilter('all');
                setQ('');
              }
            : undefined
        }
      >
        <p className="text-xs acct-top-subtitle w-full mb-1">
          الفترة المحاسبية للملخص والأعمدة (فواتير الفترة، خدمات، نتيجة) — تُحفظ في الرابط.
        </p>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="حالة السداد">
          {(
            [
              ['all', `الكل (${termCounts.all})`],
              ['NO_INVOICES', `بدون فواتير (${termCounts.NO_INVOICES})`],
              ['OVERDUE', `متأخر (${termCounts.OVERDUE})`],
              ['DUE_SOON', `يستحق قريباً (${termCounts.DUE_SOON})`],
              ['PAID_FULL', `خالص (${termCounts.PAID_FULL})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={termFilter === id}
              className={`acct-chip ${termFilter === id ? 'acct-chip-active' : ''}`}
              onClick={() => {
                setTermFilter(id);
                if (id === 'OVERDUE') setKpiDrill('overdue');
                else if (id === 'DUE_SOON') setKpiDrill('due_soon');
                else if (id === 'PAID_FULL') setKpiDrill('settled');
                else setKpiDrill(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`acct-chip ${catFilter === 'all' ? 'acct-chip-active' : ''}`}
            onClick={() => setCatFilter('all')}
          >
            الكل
            <span className="opacity-80 tabular-nums">{catCounts.all || 0}</span>
          </button>
          {SUPPLIER_CATEGORIES.filter(
            (c) =>
              (!lane || supplierLane({ category: c.id }) === lane.id) &&
              ((catCounts[c.id] || 0) > 0 || catFilter === c.id)
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              className={`acct-chip ${catFilter === c.id ? 'acct-chip-active' : ''}`}
              onClick={() => setCatFilter(c.id)}
            >
              {c.label}
              <span className="opacity-80 tabular-nums">{catCounts[c.id] || 0}</span>
            </button>
          ))}
        </div>
      </FilterDrawer>
          </div>
        </div>

        <div className="acct-supplier-board-table">{supplierDrillTable(directoryRows)}</div>
      </section>

      <Disclosure title="ملخص الموردين (محاسبي)" defaultOpen={false}>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
          <Stat
            label="إجمالي المفوتر"
            value={kpis.totalInvoiced}
            active={kpiDrill === 'invoiced'}
            onClick={() => toggleDrill('invoiced')}
          />
          <Stat
            label="إجمالي المدفوع"
            value={kpis.totalPaid}
            tone="text-emerald-700"
            delay={40}
            active={kpiDrill === 'paid'}
            onClick={() => toggleDrill('paid')}
          />
          <Stat
            label="غير المدفوع"
            value={kpis.totalUnpaid}
            tone="text-amber-700"
            delay={80}
            active={kpiDrill === 'unpaid'}
            onClick={() => toggleDrill('unpaid')}
          />
          <Stat
            label="متأخر السداد"
            value={kpis.overdue}
            tone={kpis.overdue > 0 ? 'text-rose-600' : 'opacity-50'}
            delay={120}
            active={kpiDrill === 'overdue'}
            onClick={() => toggleDrill('overdue')}
          />
          <Stat
            label="يستحق خلال 7 أيام"
            value={kpis.dueSoon}
            tone={kpis.dueSoon > 0 ? 'text-amber-700' : 'opacity-50'}
            delay={160}
            active={kpiDrill === 'due_soon'}
            onClick={() => toggleDrill('due_soon')}
          />
          <Stat
            label="خالص بالكامل"
            value={kpis.settledCount}
            tone="text-emerald-700"
            delay={200}
            active={kpiDrill === 'settled'}
            onClick={() => toggleDrill('settled')}
          />
        </div>

        {kpiDrill === 'invoiced' ? (
          <div className="acct-kpi-detail acct-slide-down">
            <div className="acct-kpi-detail-head">
              إجمالي المفوتر ({fmtMoney(kpis.totalInvoiced)}) — {fmtCount(invoicedDrillRows.length)} مورد
            </div>
            {supplierDrillTable(invoicedDrillRows)}
          </div>
        ) : null}

        {kpiDrill === 'paid' ? (
          <div className="acct-kpi-detail acct-slide-down">
            <div className="acct-kpi-detail-head">
              إجمالي المدفوع ({fmtMoney(kpis.totalPaid)}) — {fmtCount(paidSuppliers.length)} مورد
            </div>
            {supplierDrillTable(paidSuppliers)}
          </div>
        ) : null}

        {kpiDrill === 'unpaid' ? (
          <div className="acct-kpi-detail acct-slide-down">
            <div className="acct-kpi-detail-head">
              غير المدفوع / الذمم ({fmtMoney(kpis.totalUnpaid)}) — {fmtCount(unpaidSuppliers.length)} مورد
            </div>
            {supplierDrillTable(unpaidSuppliers)}
          </div>
        ) : null}

        {kpiDrill === 'overdue' ? (
          <div className="acct-kpi-detail acct-slide-down">
            <div className="acct-kpi-detail-head">
              متأخر السداد ({fmtMoney(kpis.overdue)}) — {fmtCount(overdueSuppliers.length)} مورد
            </div>
            {supplierDrillTable(overdueSuppliers, { showOverdue: true })}
          </div>
        ) : null}

        {kpiDrill === 'due_soon' ? (
          <div className="acct-kpi-detail acct-slide-down">
            <div className="acct-kpi-detail-head">
              يستحق خلال 7 أيام ({fmtMoney(kpis.dueSoon)}) — {fmtCount(dueSoonSuppliers.length)} مورد
            </div>
            {supplierDrillTable(dueSoonSuppliers)}
          </div>
        ) : null}

        {kpiDrill === 'settled' ? (
          <div className="acct-kpi-detail acct-slide-down">
            <div className="acct-kpi-detail-head">خالص بالكامل — {fmtCount(settledSuppliers.length)} مورد</div>
            {supplierDrillTable(settledSuppliers, { showSettledOnly: true })}
          </div>
        ) : null}
      </Disclosure>

      {drawerOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 acct-drawer-backdrop cursor-pointer border-0"
            aria-label="إغلاق"
            onClick={closeDrawer}
          />
          <aside
            className="relative z-10 h-full w-full acct-supplier-sheet acct-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-drawer-title"
          >
            <div className="acct-supplier-sheet-head">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <EntityAvatar
                    name={selectedSupplier.name_ar}
                    imageUrl={resolveSupplierImageUrl(selectedSupplier)}
                    category={selectedSupplier.category}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <h4 id="supplier-drawer-title" className="text-lg font-black truncate leading-tight">
                      {selectedSupplier.name_ar}
                    </h4>
                    <div className="text-xs mt-1.5 flex flex-wrap items-center gap-1.5" style={{ color: 'var(--acct-muted)' }}>
                      <span className="font-mono tabular-nums">{selectedSupplier.code}</span>
                      <span className="opacity-40">·</span>
                      <span>{supplierCategoryLabel(selectedSupplier.category)}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          statusLabel(selectedSupplier.status).cls
                        }`}
                      >
                        {statusLabel(selectedSupplier.status).text}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    className="acct-drawer-iconbtn"
                    onClick={openEdit}
                    aria-label="تعديل المورد"
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    className="acct-drawer-iconbtn"
                    onClick={closeDrawer}
                    aria-label="إغلاق"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {(() => {
                const inv = totals?.total_invoiced ?? selectedAging?.total_invoiced ?? 0;
                const paid = totals?.total_paid ?? selectedAging?.total_paid ?? 0;
                const bal = totals?.balance ?? selectedAging?.total_remaining ?? 0;
                return (
                  <div className="acct-supplier-ledger-summary">
                    <button
                      type="button"
                      className="acct-supplier-ledger-card"
                      onClick={() => goDrawerDetail('invoices', 'all')}
                    >
                      <span className="acct-supplier-ledger-label">مفوتر</span>
                      <span className="acct-supplier-ledger-value tabular-nums">{fmtMoney(inv)}</span>
                    </button>
                    <button
                      type="button"
                      className="acct-supplier-ledger-card is-paid"
                      onClick={() => goDrawerDetail('payments')}
                    >
                      <span className="acct-supplier-ledger-label">مدفوع</span>
                      <span className="acct-supplier-ledger-value tabular-nums text-emerald-700">
                        {fmtMoney(paid)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="acct-supplier-ledger-card is-balance"
                      onClick={() => goDrawerDetail('invoices', 'open')}
                    >
                      <span className="acct-supplier-ledger-label">متبقي</span>
                      <span
                        className={`acct-supplier-ledger-value tabular-nums ${
                          bal > 0 ? 'text-amber-700' : bal < 0 ? 'text-sky-700' : ''
                        }`}
                      >
                        {fmtMoney(bal)}
                      </span>
                    </button>
                  </div>
                );
              })()}

              <div className="acct-supplier-drawer-actions">
                <button type="button" className="acct-btn acct-btn-primary flex-1" onClick={openNewPayment}>
                  دفعة
                </button>
                <button type="button" className="acct-btn acct-btn-ghost flex-1" onClick={openNewInvoice}>
                  فاتورة
                </button>
                <AcctPrintButton
                  label="معاينة / طباعة"
                  onClick={() => {
                    if (!selected) return;
                    router.push(`/portal/suppliers/print?supplier=${encodeURIComponent(selected)}`);
                  }}
                />
              </div>

              <div className="acct-seg acct-seg-compact" role="tablist">
                {DRAWER_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={drawerTab === t.id}
                    onClick={() => setDrawerTab(t.id)}
                    className={drawerTab === t.id ? 'is-on' : ''}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="acct-supplier-sheet-body">
              {err && <p className="text-xs font-bold text-rose-600">{err}</p>}

              {drawerTab === 'invoices' && (
                <div className="acct-invoice-list-wrap acct-supplier-panel acct-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className={`acct-chip ${invoiceListFilter === 'all' ? 'acct-chip-active' : ''}`}
                        onClick={() => setInvoiceListFilter('all')}
                      >
                        الكل
                      </button>
                      <button
                        type="button"
                        className={`acct-chip ${invoiceListFilter === 'open' ? 'acct-chip-active' : ''}`}
                        onClick={() => setInvoiceListFilter('open')}
                      >
                        مفتوحة
                      </button>
                      <button
                        type="button"
                        className={`acct-chip ${invoiceListFilter === 'void' ? 'acct-chip-active' : ''}`}
                        onClick={() => setInvoiceListFilter('void')}
                      >
                        الملغاة
                        <span className="opacity-80 tabular-nums">
                          {invoices.filter((i) => i.status === 'VOID').length}
                        </span>
                      </button>
                    </div>
                    {drawerInvoices.length > 0 ? (
                      <span className="text-xs font-bold tabular-nums opacity-70">
                        متبقٍ {fmtMoney(drawerInvoiceTotals.remaining)}
                      </span>
                    ) : null}
                  </div>
                  <div className="acct-invoice-list-scroll">
                    <table className="acct-invoice-list">
                      <thead>
                        <tr>
                          <th>الرقم</th>
                          <th>التاريخ</th>
                          <th>الاستحقاق</th>
                          <th className="acct-num">المبلغ</th>
                          <th className="acct-num">المتبقي</th>
                          <th>الحالة</th>
                          <th aria-label="إجراءات" />
                        </tr>
                      </thead>
                      <tbody>
                        {drawerInvoices.map((i) => {
                          const st = invoiceStatusLabel(i.status);
                          const overdue =
                            i.status !== 'PAID' && i.status !== 'VOID' && i.due_date && i.due_date < todayISO();
                          return (
                            <tr key={i.id} className={overdue ? 'is-overdue' : undefined}>
                              <td className="font-bold">{i.invoice_no || '—'}</td>
                              <td className="tabular-nums whitespace-nowrap">{i.invoice_date || '—'}</td>
                              <td className="tabular-nums whitespace-nowrap">{i.due_date || '—'}</td>
                              <td className="acct-num tabular-nums">{fmtMoney(i.amount)}</td>
                              <td className="acct-num tabular-nums font-bold">{fmtMoney(i.remaining)}</td>
                              <td>
                                <span className={`acct-invoice-status ${st.cls}`}>{st.text}</span>
                              </td>
                              <td className="acct-invoice-actions">
                                {i.status === 'VOID' ? (
                                  <button
                                    type="button"
                                    className="acct-drawer-iconbtn"
                                    onClick={() => openEditInvoice(i)}
                                  >
                                    تفاصيل
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      className="acct-drawer-iconbtn"
                                      onClick={() => openEditInvoice(i)}
                                    >
                                      تعديل
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      className="acct-drawer-iconbtn"
                                      onClick={() =>
                                        router.push(
                                          `/portal/suppliers/invoice/print?supplier=${encodeURIComponent(selected || '')}&invoice=${encodeURIComponent(i.id)}`
                                        )
                                      }
                                    >
                                      طباعة
                                    </button>
                                  </>
                                )}
                                {Number(i.paid_amount || 0) === 0 && i.status !== 'VOID' ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    className="acct-drawer-iconbtn text-rose-600"
                                    onClick={() => voidInvoice(i.id)}
                                  >
                                    إلغاء
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {drawerInvoices.length === 0 ? (
                      <p className="py-10 text-center text-sm opacity-50">لا فواتير</p>
                    ) : null}
                  </div>
                </div>
              )}

              {drawerTab === 'payments' && (
                <div className="acct-supplier-panel acct-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className={`acct-chip ${payListFilter === 'live' ? 'acct-chip-active' : ''}`}
                        onClick={() => setPayListFilter('live')}
                      >
                        الدفعات
                      </button>
                      <button
                        type="button"
                        className={`acct-chip ${payListFilter === 'void' ? 'acct-chip-active' : ''}`}
                        onClick={() => setPayListFilter('void')}
                      >
                        الملغاة
                        <span className="opacity-80 tabular-nums">{voidPayments.length}</span>
                      </button>
                    </div>
                  </div>
                  <div className="acct-invoice-list-scroll">
                    <table className="acct-invoice-list acct-pay-list">
                      <thead>
                        <tr>
                          <th>التاريخ</th>
                          <th>الطريقة</th>
                          <th>التخصيص</th>
                          <th className="acct-num">المبلغ</th>
                          <th aria-label="إجراءات" />
                        </tr>
                      </thead>
                      <tbody>
                        {shownPayments.map((p) => {
                          const voided = String(p.status || '').toUpperCase() === 'VOID';
                          const linked = p.invoice_id
                            ? invoices.find((i) => i.id === p.invoice_id)?.invoice_no || 'فاتورة'
                            : 'على الحساب';
                          return (
                            <tr key={p.id} className={voided ? 'is-void' : undefined}>
                              <td className="tabular-nums whitespace-nowrap">{p.payment_date || '—'}</td>
                              <td className="font-bold">{methodLabel(p.method)}</td>
                              <td>
                                <span className="block">{linked}</span>
                                {p.note ? <span className="acct-pay-note">{p.note}</span> : null}
                              </td>
                              <td className="acct-num tabular-nums font-bold text-emerald-700">{fmtMoney(p.amount)}</td>
                              <td className="acct-invoice-actions">
                                {voided ? (
                                  <span className="acct-invoice-status">ملغاة</span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      className="acct-drawer-iconbtn"
                                      onClick={() => openEditPayment(p)}
                                    >
                                      تعديل
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      className="acct-drawer-iconbtn text-rose-600"
                                      onClick={() => deletePayment(p.id)}
                                    >
                                      إلغاء
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {shownPayments.length === 0 ? (
                      <p className="py-10 text-center text-sm opacity-50">
                        {payListFilter === 'void' ? 'لا دفعات ملغاة' : 'لا دفعات'}
                      </p>
                    ) : null}
                  </div>
                  {payListFilter === 'live' && livePayments.length > 0 ? (
                    <div className="acct-stmt-total acct-pay-total">
                      <span>إجمالي الدفعات</span>
                      <strong className="tabular-nums">{fmtMoney(paymentTotal)}</strong>
                    </div>
                  ) : null}
                </div>
              )}

              {drawerTab === 'statement' && (
                <div className="acct-supplier-panel acct-fade-in">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-bold opacity-60">حركة الحساب</span>
                    <button
                      type="button"
                      className="px-2.5 py-1.5 rounded-lg acct-muted text-[11px] font-bold cursor-pointer disabled:opacity-40"
                      onClick={exportStatement}
                      disabled={statement.length === 0}
                    >
                      تصدير CSV
                    </button>
                  </div>
                  <div className="acct-invoice-list-scroll">
                    <table className="acct-invoice-list acct-stmt">
                      <thead>
                        <tr>
                          <th>التاريخ</th>
                          <th>البيان</th>
                          <th className="acct-num">مدين</th>
                          <th className="acct-num">دائن</th>
                          <th className="acct-num">الرصيد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statement.map((l) => (
                          <tr key={`${l.kind}-${l.id}`}>
                            <td className="tabular-nums whitespace-nowrap">{l.date}</td>
                            <td>
                              <span className={`acct-stmt-kind ${l.kind === 'PAYMENT' ? 'is-pay' : 'is-inv'}`}>
                                {l.kind === 'PAYMENT' ? 'دفعة' : 'فاتورة'}
                              </span>
                              <span className="acct-stmt-ref">{l.ref}</span>
                            </td>
                            <td className="acct-num tabular-nums text-amber-800">
                              {l.debit ? fmtMoney(l.debit) : '—'}
                            </td>
                            <td className="acct-num tabular-nums text-emerald-700">
                              {l.credit ? fmtMoney(l.credit) : '—'}
                            </td>
                            <td className="acct-num tabular-nums font-bold">{fmtMoney(l.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {statementTotalsRow ? (
                        <tfoot>
                          <tr className="acct-stmt-total">
                            <td colSpan={2}>الإجمالي</td>
                            <td className="acct-num tabular-nums">{fmtMoney(statementTotalsRow.debit)}</td>
                            <td className="acct-num tabular-nums">{fmtMoney(statementTotalsRow.credit)}</td>
                            <td className="acct-num tabular-nums">{fmtMoney(statementTotalsRow.balance)}</td>
                          </tr>
                        </tfoot>
                      ) : null}
                    </table>
                  </div>
                  {statement.length === 0 && <p className="py-6 text-center opacity-60 text-xs">لا حركة بعد</p>}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setAddOpen(false)}
        >
          <form
            className="acct-card rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onSubmit={addSupplier}
          >
            <h4 className="font-bold">مورد جديد</h4>
            {err && <p className="text-xs font-bold text-rose-600">{err}</p>}
            <input
              required
              autoFocus
              className="acct-input w-full"
              placeholder="الاسم بالعربية"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
            />
            <label className="block text-sm font-bold">
              التصنيف (نشاط)
              <select
                className="acct-input w-full mt-1"
                value={newCategory}
                onChange={(e) => {
                  const cat = normalizeSupplierCategory(e.target.value);
                  setNewCategory(cat);
                  if (lane?.id !== 'investment') setNewScfCode(scfCodeForSupplierCategory(cat));
                }}
              >
                {SUPPLIER_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <ScfClass6AccountSelect
              required
              accountClass={lane?.id === 'investment' ? 2 : 6}
              value={newScfCode}
              onChange={(code) => setNewScfCode(code)}
              hint={
                lane?.id === 'investment'
                  ? 'حساب التثبيت من الفئة 2'
                  : 'من دليل الحسابات — يحدد بند حساب النتيجة للفواتير'
              }
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-2 rounded-xl acct-muted font-bold cursor-pointer"
                onClick={() => setAddOpen(false)}
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busy || !newScfCode}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
              >
                حفظ
              </button>
            </div>
          </form>
        </div>
      )}

      {editOpen && selectedSupplier && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setEditOpen(false)}
        >
          <form
            className="acct-card rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveSupplier}
          >
            <h4 className="font-bold">بيانات المورد</h4>
            {err && <p className="text-xs font-bold text-rose-600">{err}</p>}
            <div className="flex items-center gap-3">
              <EntityAvatar
                name={editForm.name_ar || selectedSupplier.name_ar}
                imageUrl={editForm.image_url || resolveSupplierImageUrl(selectedSupplier)}
                category={editForm.category}
                size="md"
              />
              <label className="block text-xs font-bold flex-1">
                شعار / صورة
                <input
                  type="file"
                  accept="image/*"
                  className="acct-input w-full mt-1 text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void uploadSupplierImage(file).catch((ex) =>
                      setErr(ex instanceof Error ? ex.message : 'تعذّر رفع الصورة')
                    );
                  }}
                />
              </label>
            </div>
            <label className="block text-xs font-bold">
              الاسم
              <input
                required
                className="acct-input w-full mt-1"
                value={editForm.name_ar}
                onChange={(e) => setEditForm((f) => ({ ...f, name_ar: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold">
                الرمز
                <input
                  required
                  className="acct-input w-full mt-1"
                  value={editForm.code}
                  onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold">
                أجل السداد (يوم)
                <input
                  type="number"
                  min={0}
                  max={365}
                  className="acct-input w-full mt-1"
                  value={editForm.payment_terms_days}
                  onChange={(e) => setEditForm((f) => ({ ...f, payment_terms_days: Number(e.target.value) }))}
                />
              </label>
            </div>
            <label className="block text-xs font-bold">
              جهة الاتصال
              <input
                className="acct-input w-full mt-1"
                placeholder="هاتف / بريد / مسؤول"
                value={editForm.contact}
                onChange={(e) => setEditForm((f) => ({ ...f, contact: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold">
                التصنيف (نشاط)
                <select
                  className="acct-input w-full mt-1"
                  value={editForm.category}
                  onChange={(e) => {
                    const cat = normalizeSupplierCategory(e.target.value);
                    setEditForm((f) => ({
                      ...f,
                      category: cat,
                      scf_code: scfCodeForSupplierCategory(cat),
                    }));
                  }}
                >
                  {SUPPLIER_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold">
                الحالة
                <select
                  className="acct-input w-full mt-1"
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="ACTIVE">نشط</option>
                  <option value="INACTIVE">موقوف</option>
                </select>
              </label>
            </div>
            <ScfClass6AccountSelect
              required
              accountClass={String(editForm.scf_code || '').startsWith('2') || lane?.id === 'investment' ? 2 : 6}
              value={editForm.scf_code}
              onChange={(code) => setEditForm((f) => ({ ...f, scf_code: code }))}
              hint={
                String(editForm.scf_code || '').startsWith('2') || lane?.id === 'investment'
                  ? 'حساب التثبيت من الفئة 2'
                  : 'حساب المصروف في حساب النتيجة (SCF)'
              }
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-2 rounded-xl acct-muted font-bold cursor-pointer"
                onClick={() => setEditOpen(false)}
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busy || !editForm.scf_code}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
              >
                حفظ
              </button>
            </div>
          </form>
        </div>
      )}

      {payOpen && selected && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setPayOpen(false)}
        >
          <form
            className="acct-card rounded-2xl p-6 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={pay}
          >
            <h4 className="font-bold">{editingPayId ? 'تعديل دفعة' : 'دفعة مورد'}</h4>
            {err && <p className="text-xs font-bold text-rose-600">{err}</p>}
            <label className="block text-xs font-bold">
              المبلغ
              <input
                type="number"
                required
                autoFocus
                min={1}
                className="acct-input w-full mt-1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold">
                الطريقة
                <select
                  className="acct-input w-full mt-1"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {PAY_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold">
                التاريخ
                <input
                  type="date"
                  className="acct-input w-full mt-1"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-xs font-bold">
              تخصيص لفاتورة
              <select
                className="acct-input w-full mt-1"
                value={invoiceId}
                onChange={(e) => {
                  setInvoiceId(e.target.value);
                  const target = openInvoices.find((i) => i.id === e.target.value);
                  if (target) setAmount(Number(target.remaining) || 0);
                }}
              >
                <option value="">على الحساب (بدون فاتورة)</option>
                {linkableInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoice_no} — متبقي {fmtMoney(i.remaining)}
                    {i.status === 'PAID' ? ' (مسددة)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold">
              ملاحظة
              <input
                className="acct-input w-full mt-1"
                placeholder="مرجع الحوالة / الشيك (اختياري)"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-2 rounded-xl acct-muted font-bold cursor-pointer"
                onClick={() => setPayOpen(false)}
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
              >
                {editingPayId ? 'حفظ التعديل' : 'تسجيل وترحيل'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

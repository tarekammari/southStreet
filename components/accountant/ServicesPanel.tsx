'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fmtCount, fmtMoney, PAY_METHODS } from './money';
import { Disclosure, FilterDrawer, Kpi, PanelHeader } from './ui';
import ScfClass6AccountSelect from './ScfClass6AccountSelect';

type StmtItem = {
  id: string;
  name_ar: string;
  amount: number;
  paid: number;
  unpaid: number;
  occurrences: number;
  unit_amount: number;
  frequency: string;
  provider?: string;
};

type AccrualLine = {
  id: string;
  service_id: string;
  name_ar: string;
  due_date: string;
  amount: number;
  frequency: string;
};

type ServiceRecord = {
  id: string;
  name_ar: string;
  frequency: string;
  amount: number;
  next_due_date: string;
  provider: string;
  status: string;
  note: string;
  scf_code?: string;
  created_at?: string;
};

type ServicePaymentLine = {
  id: string;
  service_id: string;
  amount: number;
  payment_date: string;
  method: string;
  note?: string;
};

type ServiceForm = {
  name_ar: string;
  provider: string;
  amount: string;
  frequency: string;
  next_due_date: string;
  status: string;
  note: string;
  scf_code: string;
};

type DrawerMode = 'view' | 'edit' | 'create';

const FREQ_OPTIONS = [
  { value: 'MONTHLY', label: 'شهري' },
  { value: 'QUARTERLY', label: 'ربع سنوي' },
  { value: 'YEARLY', label: 'سنوي' },
  { value: 'ONE_OFF', label: 'مرّة واحدة' },
] as const;

const freqLabel = (f: string) => FREQ_OPTIONS.find((o) => o.value === f)?.label || f;

const emptyForm = (): ServiceForm => ({
  name_ar: '',
  provider: '',
  amount: '',
  frequency: 'MONTHLY',
  next_due_date: new Date().toISOString().slice(0, 10),
  status: 'ACTIVE',
  note: '',
  scf_code: '613',
});

const recordToForm = (s: ServiceRecord): ServiceForm => ({
  name_ar: s.name_ar || '',
  provider: s.provider || '',
  amount: String(s.amount ?? ''),
  frequency: String(s.frequency || 'MONTHLY').toUpperCase(),
  next_due_date: String(s.next_due_date || '').slice(0, 10),
  status: String(s.status || 'ACTIVE').toUpperCase(),
  note: s.note || '',
  scf_code: String(s.scf_code || '613'),
});

const MONTHS = [
  'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
  'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const monthLabel = (m: number) => MONTHS[m - 1] || String(m);

type ScopeId = 'year' | 'month' | 'all' | 'custom';

const SCOPES: { id: ScopeId; label: string }[] = [
  { id: 'month', label: 'هذا الشهر' },
  { id: 'year', label: 'هذه السنة' },
  { id: 'all', label: 'كل الفترات' },
  { id: 'custom', label: 'مخصص' },
];

type ServiceKpiDrill = 'due' | 'paid' | 'unpaid';

const pad2 = (n: number) => String(n).padStart(2, '0');

const lastDayOfMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

function isoRangeForScope(
  scope: ScopeId,
  year: number,
  fromMonth: number,
  toMonth: number,
  today: { year: number; month: number }
): { from: string; to: string } | null {
  if (scope === 'all') return null;
  if (scope === 'month') {
    const y = today.year;
    const m = today.month;
    return {
      from: `${y}-${pad2(m)}-01`,
      to: `${y}-${pad2(m)}-${pad2(lastDayOfMonth(y, m))}`,
    };
  }
  if (scope === 'year') {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  const from = `${year}-${pad2(fromMonth)}-01`;
  const to = `${year}-${pad2(toMonth)}-${pad2(lastDayOfMonth(year, toMonth))}`;
  return { from, to };
}

function inRange(iso: string, from: string, to: string) {
  const d = String(iso || '').slice(0, 10);
  return d >= from && d <= to;
}

function ClickableRow({
  serviceId,
  onOpen,
  children,
}: {
  serviceId: string;
  onOpen: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <tr
      className="acct-kpi-detail-row-btn"
      onClick={() => onOpen(serviceId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(serviceId);
        }
      }}
      tabIndex={0}
      role="button"
    >
      {children}
    </tr>
  );
}

type ServicesPanelProps = {
  /** When set, only this fournisseur’s recurring services (embedded in الموردون). */
  supplierId?: string;
  supplierName?: string;
  embedded?: boolean;
};

export default function ServicesPanel({ supplierId, supplierName, embedded = false }: ServicesPanelProps = {}) {
  const searchParams = useSearchParams();
  const recapFrom = searchParams.get('from')?.slice(0, 10) || '';
  const recapTo = searchParams.get('to')?.slice(0, 10) || '';
  const recapPeriod = recapFrom && recapTo;

  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, []);

  const [scope, setScope] = useState<ScopeId>('year');
  const [year, setYear] = useState(today.year);
  const [fromMonth, setFromMonth] = useState(1);
  const [toMonth, setToMonth] = useState(today.month);
  const [upcoming, setUpcoming] = useState(0);
  const [allServices, setAllServices] = useState<ServiceRecord[]>([]);
  const [svcPay, setSvcPay] = useState<{ id: string; amount: number; name: string } | null>(null);
  const [method, setMethod] = useState('CASH');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [kpiDrill, setKpiDrill] = useState<ServiceKpiDrill | null>(() => {
    const f = searchParams.get('focus');
    return f === 'services' || f === 'drill' ? 'due' : null;
  });
  const [serviceStmt, setServiceStmt] = useState<{
    total: number;
    paid: number;
    unpaid: number;
    items: StmtItem[];
    accrual_lines: AccrualLine[];
  } | null>(null);
  const [paymentLines, setPaymentLines] = useState<ServicePaymentLine[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view');
  const [selectedId, setSelectedId] = useState('');
  const [detailPayments, setDetailPayments] = useState<ServicePaymentLine[]>([]);
  const [form, setForm] = useState<ServiceForm>(emptyForm);

  const stmtRange = useMemo(() => {
    if (recapPeriod) return { from: recapFrom, to: recapTo };
    return isoRangeForScope(scope, year, fromMonth, toMonth, today);
  }, [recapPeriod, recapFrom, recapTo, scope, year, fromMonth, toMonth, today]);

  const selectedService = useMemo(
    () => allServices.find((s) => s.id === selectedId) || null,
    [allServices, selectedId]
  );

  const periodLine = useMemo(
    () => (selectedId ? serviceStmt?.items.find((i) => i.id === selectedId) : undefined),
    [selectedId, serviceStmt]
  );

  const toggleDrill = (id: ServiceKpiDrill) => {
    setKpiDrill((d) => (d === id ? null : id));
  };

  const load = useCallback(() => {
    setErr('');
    fetch('/api/finance/services/upcoming')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setUpcoming((d.items || []).length))
      .catch(() => setUpcoming(0));

    const svcUrl = supplierId
      ? `/api/finance/services?supplier_id=${encodeURIComponent(supplierId)}`
      : '/api/finance/services';
    fetch(svcUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setAllServices(d.items || []))
      .catch(() => setAllServices([]));

    if (stmtRange) {
      const q = `from=${encodeURIComponent(stmtRange.from)}&to=${encodeURIComponent(stmtRange.to)}`;
      fetch(`/api/finance/services/statement?${q}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) =>
          setServiceStmt({
            total: Number(d.total) || 0,
            paid: Number(d.paid) || 0,
            unpaid: Number(d.unpaid) || 0,
            items: d.items || [],
            accrual_lines: d.accrual_lines || [],
          })
        )
        .catch(() => setServiceStmt(null));

      fetch(`/api/finance/services/payments?${q}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          const lines = (d.items || []) as ServicePaymentLine[];
          setPaymentLines(
            lines.filter((p) => inRange(String(p.payment_date || ''), stmtRange.from, stmtRange.to))
          );
        })
        .catch(() => setPaymentLines([]));
    } else {
      setServiceStmt(null);
      setPaymentLines([]);
    }
  }, [stmtRange, supplierId]);

  const loadServiceDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/finance/services/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('تعذر تحميل التفاصيل');
    const data = await res.json();
    setDetailPayments(data.payments || []);
    if (data.service) {
      setAllServices((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx < 0) return [...prev, data.service];
        const next = [...prev];
        next[idx] = data.service;
        return next;
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (drawerOpen && selectedId && drawerMode === 'view') {
      loadServiceDetail(selectedId).catch(() => setDetailPayments([]));
    }
  }, [drawerOpen, selectedId, drawerMode, loadServiceDetail]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (svcPay) setSvcPay(null);
      else if (drawerOpen) closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const openService = (id: string) => {
    setSelectedId(id);
    setDrawerMode('view');
    setDrawerOpen(true);
    setErr('');
  };

  const openCreate = () => {
    setSelectedId('');
    const base = emptyForm();
    setForm(base);
    setDrawerMode('create');
    setDrawerOpen(true);
    setDetailPayments([]);
    setErr('');
    if (supplierId) {
      fetch(`/api/finance/suppliers/${encodeURIComponent(supplierId)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          const scf = String(d.supplier?.scf_code || '').trim();
          if (scf) setForm((f) => ({ ...f, scf_code: scf }));
        })
        .catch(() => {});
    }
  };

  const openEdit = () => {
    if (!selectedService) return;
    setForm(recordToForm(selectedService));
    setDrawerMode('edit');
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerMode('view');
    setSelectedId('');
    setForm(emptyForm());
  };

  const payService = async () => {
    if (!svcPay) return;
    const res = await fetch('/api/finance/services/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: svcPay.id, amount: svcPay.amount, method }),
    });
    if (res.ok) {
      setSvcPay(null);
      load();
      if (drawerOpen && selectedId === svcPay.id) loadServiceDetail(svcPay.id).catch(() => {});
    } else setErr('تعذّر تسجيل الدفع');
  };

  const saveForm = async () => {
    if (embedded && !supplierId) {
      setErr('اختر مورداً من قائمة الموردين أولاً');
      return;
    }
    setSaving(true);
    setErr('');
    const payload = {
      name_ar: form.name_ar.trim(),
      provider: (supplierName || form.provider).trim(),
      supplier_id: supplierId || null,
      scf_code: form.scf_code || '613',
      amount: Number(form.amount),
      frequency: form.frequency,
      next_due_date: form.next_due_date,
      status: form.status,
      note: form.note.trim(),
    };
    try {
      if (drawerMode === 'create') {
        const res = await fetch('/api/finance/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل الإنشاء');
        await load();
        if (data.id) {
          setSelectedId(String(data.id));
          setDrawerMode('view');
          await loadServiceDetail(String(data.id));
        } else closeDrawer();
      } else if (drawerMode === 'edit' && selectedId) {
        const res = await fetch(`/api/finance/services/${encodeURIComponent(selectedId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل التحديث');
        await load();
        setDrawerMode('view');
        await loadServiceDetail(selectedId);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setSaving(false);
    }
  };

  const scopeLabel = recapPeriod
    ? `فترة الملخص ${recapFrom} → ${recapTo}`
    : scope === 'all'
      ? 'كل الفترات'
      : scope === 'month'
        ? `${monthLabel(today.month)} ${today.year}`
        : scope === 'year'
          ? String(year)
          : `${monthLabel(fromMonth)} – ${monthLabel(toMonth)} ${year}`;

  const stmtItems = serviceStmt?.items ?? [];
  const accrualLines = serviceStmt?.accrual_lines ?? [];
  const accrualSum = accrualLines.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const paidByService = stmtItems.filter((r) => r.paid > 0);
  const unpaidByService = stmtItems.filter((r) => r.unpaid > 0);

  const serviceLabel = (id: string) =>
    allServices.find((s) => s.id === id)?.name_ar ||
    stmtItems.find((i) => i.id === id)?.name_ar ||
    '—';

  const formFields = (
    <div className="space-y-3 text-sm">
      <ScfClass6AccountSelect
        required
        value={form.scf_code}
        onChange={(code, account) =>
          setForm((f) => ({
            ...f,
            scf_code: code,
            name_ar: f.name_ar.trim() ? f.name_ar : account?.label_ar || f.name_ar,
          }))
        }
        label="حساب المصروف (دليل SCF)"
        hint="يحدد البند في حساب النتيجة — مثلاً 613 إيجارات، 626 اتصالات"
      />
      <label className="block">
        <span className="text-xs font-bold opacity-70">اسم الخدمة *</span>
        <input
          className="acct-input w-full mt-1"
          value={form.name_ar}
          onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold opacity-70">المزوّد</span>
        <input
          className="acct-input w-full mt-1"
          value={form.provider}
          onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-bold opacity-70">المبلغ (دج) *</span>
          <input
            type="number"
            min={0}
            className="acct-input w-full mt-1"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold opacity-70">الدورية</span>
          <select
            className="acct-input w-full mt-1"
            value={form.frequency}
            onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
          >
            {FREQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-bold opacity-70">تاريخ الاستحقاق القادم</span>
          <input
            type="date"
            className="acct-input w-full mt-1"
            value={form.next_due_date}
            onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold opacity-70">الحالة</span>
          <select
            className="acct-input w-full mt-1"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="ACTIVE">نشطة</option>
            <option value="INACTIVE">موقوفة</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-bold opacity-70">ملاحظة</span>
        <textarea
          className="acct-input w-full mt-1 min-h-[4rem]"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
      </label>
    </div>
  );

  return (
    <div className={`space-y-4 ${embedded ? 'acct-embedded-panel' : ''}`}>
      {embedded ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs font-bold acct-top-subtitle">خدمات دورية مربوطة بهذا المورد (613/626)</p>
          <button
            type="button"
            className="acct-btn-primary text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
            onClick={openCreate}
          >
            + خدمة
          </button>
        </div>
      ) : (
        <PanelHeader
          compact
          title="الخدمات الدورية"
          action={
            <button
              type="button"
              className="acct-btn-primary text-sm font-bold px-4 py-2 rounded-xl cursor-pointer"
              onClick={openCreate}
            >
              + إضافة خدمة
            </button>
          }
        />
      )}

      <FilterDrawer activeCount={scope !== 'month' && !recapPeriod ? 1 : 0}>
        {recapPeriod ? (
          <p className="text-xs font-bold acct-top-subtitle">الفترة من الملخص — لا يمكن تغييرها هنا</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`acct-chip ${scope === s.id ? 'acct-chip-active' : ''}`}
                  onClick={() => setScope(s.id)}
                >
                  {s.label}
                </button>
              ))}
              {(scope === 'year' || scope === 'custom') && (
                <select
                  className="acct-input text-sm"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  aria-label="السنة"
                >
                  {[today.year, today.year - 1, today.year - 2].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {scope === 'custom' && (
              <div className="flex flex-wrap gap-2 items-end">
                <label className="text-xs font-medium">
                  من شهر
                  <select
                    className="acct-input block mt-1 text-sm"
                    value={fromMonth}
                    onChange={(e) => setFromMonth(Number(e.target.value))}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium">
                  إلى شهر
                  <select
                    className="acct-input block mt-1 text-sm"
                    value={toMonth}
                    onChange={(e) => setToMonth(Number(e.target.value))}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </>
        )}
      </FilterDrawer>

      {recapPeriod ? (
        <p className="text-xs font-bold acct-top-subtitle px-1">
          نفس فترة الملخص — «الخدمات الدورية» = بند الخدمات في حساب النتيجة
        </p>
      ) : (
        <p className="text-xs font-bold acct-top-subtitle px-1">
          المستحق = استحقاقات ضمن الفترة · الدفع منفصل (الخزينة) · انقر صفاً للتفاصيل
        </p>
      )}

      {upcoming > 0 ? (
        <p className="text-xs font-bold text-amber-800 px-1">{fmtCount(upcoming)} خدمة مستحقة قريباً</p>
      ) : null}

      {serviceStmt ? (
        <Disclosure title={`ملخص الفترة · ${scopeLabel}`} defaultOpen>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            <Kpi
              label="مستحق بالفترة"
              value={serviceStmt.total}
              tone="text-orange-700"
              active={kpiDrill === 'due'}
              onClick={() => toggleDrill('due')}
            />
            <Kpi
              label="مدفوع"
              value={serviceStmt.paid}
              tone="text-emerald-700"
              delay={40}
              active={kpiDrill === 'paid'}
              onClick={() => toggleDrill('paid')}
            />
            <Kpi
              label="متبقٍ"
              value={serviceStmt.unpaid}
              tone="text-amber-700"
              delay={80}
              active={kpiDrill === 'unpaid'}
              onClick={() => toggleDrill('unpaid')}
            />
          </div>

          {kpiDrill === 'due' ? (
            <div className="acct-kpi-detail acct-slide-down">
              <div className="acct-kpi-detail-head">
                مستحق بالفترة ({fmtMoney(serviceStmt.total)}) — {fmtCount(accrualLines.length)} استحقاق ·{' '}
                {fmtCount(stmtItems.length)} خدمة
              </div>
              <p className="acct-kpi-detail-hint">
                كل صف = مستحق واحد (كالفاتورة) — مجموع المبالغ = بند الخدمات في حساب النتيجة حتى لو لم يُدفع.
                انقر صفاً لفتح الخدمة.
              </p>
              <table className="acct-kpi-detail-table">
                <thead>
                  <tr>
                    <th>الخدمة</th>
                    <th>تاريخ الاستحقاق</th>
                    <th className="acct-num">المبلغ (مستحق)</th>
                    <th>الدورية</th>
                  </tr>
                </thead>
                <tbody>
                  {accrualLines.map((r) => (
                    <ClickableRow key={r.id} serviceId={r.service_id} onOpen={openService}>
                      <td>{r.name_ar}</td>
                      <td className="whitespace-nowrap tabular-nums">{r.due_date}</td>
                      <td className="acct-num font-bold text-orange-700">{fmtMoney(r.amount)}</td>
                      <td className="text-xs opacity-80">{freqLabel(r.frequency)}</td>
                    </ClickableRow>
                  ))}
                  {accrualLines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="opacity-60 text-center py-4">
                        لا استحقاقات في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    <tr className="font-bold">
                      <td colSpan={2}>المجموع (حساب النتيجة)</td>
                      <td className="acct-num text-orange-700">{fmtMoney(accrualSum)}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {kpiDrill === 'paid' ? (
            <div className="acct-kpi-detail acct-slide-down">
              <div className="acct-kpi-detail-head">
                مدفوع ({fmtMoney(serviceStmt.paid)}) — {fmtCount(paymentLines.length)} دفعة ·{' '}
                {fmtCount(paidByService.length)} خدمة
              </div>
              <p className="acct-kpi-detail-hint">انقر صفاً لفتح الخدمة.</p>
              <table className="acct-kpi-detail-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>الخدمة</th>
                    <th>الطريقة</th>
                    <th className="acct-num">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentLines.map((p) => (
                    <ClickableRow key={p.id} serviceId={String(p.service_id)} onOpen={openService}>
                      <td className="whitespace-nowrap">{String(p.payment_date || '').slice(0, 10)}</td>
                      <td>{serviceLabel(String(p.service_id))}</td>
                      <td className="text-xs opacity-80">{p.method || '—'}</td>
                      <td className="acct-num font-bold text-emerald-700">{fmtMoney(Number(p.amount) || 0)}</td>
                    </ClickableRow>
                  ))}
                  {paymentLines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="opacity-60 text-center py-4">
                        لا دفعات في هذه الفترة
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}

          {kpiDrill === 'unpaid' ? (
            <div className="acct-kpi-detail acct-slide-down">
              <div className="acct-kpi-detail-head">
                متبقٍ ({fmtMoney(serviceStmt.unpaid)}) — {fmtCount(unpaidByService.length)} خدمة
              </div>
              <p className="acct-kpi-detail-hint">انقر اسم الخدمة للتفاصيل · «دفع» لتسجيل دفعة.</p>
              <table className="acct-kpi-detail-table">
                <thead>
                  <tr>
                    <th>الخدمة</th>
                    <th className="acct-num">مستحق</th>
                    <th className="acct-num">مدفوع</th>
                    <th className="acct-num">متبقٍ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {unpaidByService.map((r) => (
                    <ClickableRow key={r.id} serviceId={r.id} onOpen={openService}>
                      <td>{r.name_ar}</td>
                      <td className="acct-num">{fmtMoney(r.amount)}</td>
                      <td className="acct-num text-emerald-700">{fmtMoney(r.paid)}</td>
                      <td className="acct-num font-bold text-amber-700">{fmtMoney(r.unpaid)}</td>
                      <td>
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSvcPay({ id: r.id, amount: r.unpaid, name: r.name_ar });
                          }}
                        >
                          دفع
                        </button>
                      </td>
                    </ClickableRow>
                  ))}
                  {unpaidByService.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="opacity-60 text-center py-4">
                        لا متبقٍ في هذه الفترة
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </Disclosure>
      ) : scope === 'all' && !recapPeriod ? (
        <p className="text-xs acct-top-subtitle px-1">اختر فترة لعرض المستحقات المحاسبية (حساب النتيجة)</p>
      ) : null}

      <Disclosure title={`جميع الخدمات · ${fmtCount(allServices.length)}`} defaultOpen={false}>
        <p className="text-xs acct-top-subtitle mb-2">سجل الخدمات الدورية — انقر للتفاصيل أو «إضافة خدمة» أعلاه.</p>
        <table className="acct-kpi-detail-table">
          <thead>
            <tr>
              <th>الخدمة</th>
              <th>المزوّد</th>
              <th>الدورية</th>
              <th className="acct-num">المبلغ</th>
              <th>الاستحقاق</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {allServices.map((s) => (
              <ClickableRow key={s.id} serviceId={s.id} onOpen={openService}>
                <td className="font-bold">{s.name_ar}</td>
                <td className="text-xs opacity-80">{s.provider || '—'}</td>
                <td className="text-xs">{freqLabel(s.frequency)}</td>
                <td className="acct-num tabular-nums">{fmtMoney(Number(s.amount) || 0)}</td>
                <td className="text-xs whitespace-nowrap">{String(s.next_due_date || '').slice(0, 10)}</td>
                <td>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      String(s.status).toUpperCase() === 'ACTIVE'
                        ? 'bg-emerald-500/15 text-emerald-700'
                        : 'bg-slate-500/15 opacity-70'
                    }`}
                  >
                    {String(s.status).toUpperCase() === 'ACTIVE' ? 'نشطة' : 'موقوفة'}
                  </span>
                </td>
              </ClickableRow>
            ))}
            {allServices.length === 0 ? (
              <tr>
                <td colSpan={6} className="opacity-60 text-center py-4">
                  لا خدمات — أضف خدمة جديدة
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Disclosure>

      {err && <p className="text-xs font-bold text-rose-600">{err}</p>}

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 acct-drawer-backdrop cursor-pointer border-0"
            aria-label="إغلاق"
            onClick={closeDrawer}
          />
          <aside
            className="relative z-10 h-full w-full max-w-lg acct-card shadow-2xl flex flex-col acct-drawer-panel overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4 border-b flex items-start justify-between gap-3" style={{ borderColor: 'var(--acct-border)' }}>
              <div className="min-w-0">
                <h4 className="text-lg font-black truncate">
                  {drawerMode === 'create'
                    ? 'خدمة جديدة'
                    : selectedService?.name_ar || 'تفاصيل الخدمة'}
                </h4>
                {drawerMode === 'view' && selectedService ? (
                  <p className="text-xs opacity-60 mt-1">
                    {freqLabel(selectedService.frequency)} · {fmtMoney(Number(selectedService.amount) || 0)} · استحقاق{' '}
                    {String(selectedService.next_due_date || '').slice(0, 10)}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2 shrink-0">
                {drawerMode === 'view' && selectedService ? (
                  <button
                    type="button"
                    className="px-2.5 py-1.5 rounded-lg acct-muted text-xs font-bold cursor-pointer"
                    onClick={openEdit}
                  >
                    تعديل
                  </button>
                ) : null}
                <button
                  type="button"
                  className="px-2.5 py-1.5 rounded-lg acct-muted text-sm font-bold cursor-pointer"
                  onClick={closeDrawer}
                >
                  إغلاق
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {drawerMode === 'view' && selectedService ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-[10px] font-bold opacity-55">حساب SCF</div>
                      <div className="font-bold font-mono text-sm">{selectedService.scf_code || '613'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold opacity-55">المزوّد</div>
                      <div className="font-bold">{selectedService.provider || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold opacity-55">الحالة</div>
                      <div className="font-bold">
                        {String(selectedService.status).toUpperCase() === 'ACTIVE' ? 'نشطة' : 'موقوفة'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold opacity-55">المبلغ للدورة</div>
                      <div className="font-black tabular-nums text-orange-700">
                        {fmtMoney(Number(selectedService.amount) || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold opacity-55">الاستحقاق القادم</div>
                      <div className="font-bold tabular-nums">
                        {String(selectedService.next_due_date || '').slice(0, 10)}
                      </div>
                    </div>
                  </div>

                  {selectedService.note ? (
                    <p className="text-xs opacity-80 leading-relaxed">{selectedService.note}</p>
                  ) : null}

                  {periodLine && stmtRange ? (
                    <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--acct-input)' }}>
                      <div className="text-xs font-black">في الفترة ({scopeLabel})</div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                          <div className="opacity-55">مستحق</div>
                          <div className="font-black text-orange-700 tabular-nums">{fmtMoney(periodLine.amount)}</div>
                        </div>
                        <div>
                          <div className="opacity-55">مدفوع</div>
                          <div className="font-black text-emerald-700 tabular-nums">{fmtMoney(periodLine.paid)}</div>
                        </div>
                        <div>
                          <div className="opacity-55">متبقٍ</div>
                          <div className="font-black text-amber-700 tabular-nums">{fmtMoney(periodLine.unpaid)}</div>
                        </div>
                      </div>
                      <p className="text-[10px] opacity-60">
                        {periodLine.occurrences}× {fmtMoney(periodLine.unit_amount)} · {freqLabel(periodLine.frequency)}
                      </p>
                      {periodLine.unpaid > 0 ? (
                        <button
                          type="button"
                          className="w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                          onClick={() =>
                            setSvcPay({
                              id: selectedService.id,
                              amount: periodLine.unpaid,
                              name: selectedService.name_ar,
                            })
                          }
                        >
                          تسجيل دفع ({fmtMoney(periodLine.unpaid)})
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div>
                    <div className="text-xs font-black mb-2">سجل الدفعات</div>
                    <table className="acct-kpi-detail-table text-sm">
                      <thead>
                        <tr>
                          <th>التاريخ</th>
                          <th>الطريقة</th>
                          <th className="acct-num">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailPayments.map((p) => (
                          <tr key={p.id}>
                            <td className="whitespace-nowrap">{String(p.payment_date || '').slice(0, 10)}</td>
                            <td className="text-xs opacity-80">{p.method || '—'}</td>
                            <td className="acct-num text-emerald-700 font-bold">
                              {fmtMoney(Number(p.amount) || 0)}
                            </td>
                          </tr>
                        ))}
                        {detailPayments.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="opacity-60 text-center py-3">
                              لا دفعات مسجّلة
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {(drawerMode === 'edit' || drawerMode === 'create') && (
                <>
                  {formFields}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      className="flex-1 py-2.5 rounded-xl acct-muted font-bold cursor-pointer"
                      onClick={() => {
                        if (drawerMode === 'create') closeDrawer();
                        else setDrawerMode('view');
                      }}
                      disabled={saving}
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-bold cursor-pointer disabled:opacity-50"
                      onClick={saveForm}
                      disabled={saving || !form.name_ar.trim() || !Number(form.amount) || !form.scf_code}
                    >
                      {saving ? '…' : drawerMode === 'create' ? 'إنشاء' : 'حفظ'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {svcPay && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSvcPay(null)}
        >
          <div
            className="acct-card rounded-2xl p-6 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-bold">دفع خدمة</h4>
            <p className="text-sm opacity-80">{svcPay.name}</p>
            <p className="text-lg font-black tabular-nums">{fmtMoney(svcPay.amount)}</p>
            <select
              className="acct-input w-full"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {PAY_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-2 rounded-xl acct-muted font-bold cursor-pointer"
                onClick={() => setSvcPay(null)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                onClick={payService}
              >
                تأكيد الدفع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

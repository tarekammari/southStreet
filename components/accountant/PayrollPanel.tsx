'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fmtCount, fmtMoney, PAY_METHODS } from './money';
import {
  Disclosure,
  FilterDrawer,
  Kpi,
  PanelHeader,
  SlideList,
  SlideListEmpty,
  SlideListFooter,
  SlideListItem,
} from './ui';
import EntityAvatar from './EntityAvatar';
import AcctPrintButton from './AcctPrintButton';

type Line = {
  id: string;
  period_year: number;
  period_month: number;
  amount: number;
  status: string;
  paid_at: string;
  note: string;
  kind?: string;
};

type OpModal =
  | null
  | { mode: 'create'; kind: 'salary' | 'advance' }
  | { mode: 'edit'; line: Line };

const todayISO = () => new Date().toISOString().slice(0, 10);

const kindLabel = (k?: string) => (String(k || '').toLowerCase() === 'advance' ? 'تسبيق' : 'راتب');

type Staff = {
  key: string;
  staff_name: string;
  morshid_id: string;
  staff_photo?: string;
  total: number;
  paid_total: number;
  pending_total: number;
  months: number;
  paid_months: number;
  pending_months: number;
  last_paid_at: string;
  lines: Line[];
};

type Payroll = {
  staff: Staff[];
  years: number[];
  total: number;
  paid_total: number;
  pending_total: number;
  staff_count: number;
  lines_count: number;
};

const MONTHS = [
  'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
  'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const monthLabel = (m: number) => MONTHS[m - 1] || String(m);

type ScopeId = 'year' | 'month' | 'all' | 'custom';
type DrawerTab = 'overview' | 'months';

const SCOPES: { id: ScopeId; label: string }[] = [
  { id: 'month', label: 'هذا الشهر' },
  { id: 'year', label: 'هذه السنة' },
  { id: 'all', label: 'كل الفترات' },
  { id: 'custom', label: 'مخصص' },
];

const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'months', label: 'الأشهر' },
];

export default function PayrollPanel() {
  const router = useRouter();
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
  const [data, setData] = useState<Payroll | null>(null);
  const [drawerKey, setDrawerKey] = useState('');
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');
  const [opModal, setOpModal] = useState<OpModal>(null);
  const [opBusy, setOpBusy] = useState(false);
  const [opForm, setOpForm] = useState({
    amount: '',
    period_year: today.year,
    period_month: today.month,
    note: '',
    pay_now: false,
    payment_date: todayISO(),
    method: 'CASH',
    kind: 'salary' as 'salary' | 'advance',
  });
  const [err, setErr] = useState('');

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (recapPeriod) {
      p.set('from', recapFrom);
      p.set('to', recapTo);
      return p;
    }
    if (scope === 'all') return p;
    if (scope === 'month') {
      p.set('from_year', String(today.year));
      p.set('from_month', String(today.month));
      p.set('to_year', String(today.year));
      p.set('to_month', String(today.month));
      return p;
    }
    if (scope === 'year') {
      p.set('from_year', String(year));
      p.set('from_month', '1');
      p.set('to_year', String(year));
      p.set('to_month', '12');
      return p;
    }
    p.set('from_year', String(year));
    p.set('from_month', String(fromMonth));
    p.set('to_year', String(year));
    p.set('to_month', String(toMonth));
    return p;
  }, [recapPeriod, recapFrom, recapTo, scope, year, fromMonth, toMonth, today.year, today.month]);
  const query = params.toString();

  const load = useCallback(() => {
    setErr('');
    fetch(`/api/finance/salaries/staff?${query}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('تعذر تحميل الرواتب'))))
      .then(setData)
      .catch((e) => setErr(e.message || 'خطأ'));
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const activeStaff = useMemo(
    () => (drawerKey ? data?.staff.find((s) => s.key === drawerKey) : undefined),
    [data, drawerKey]
  );

  const openStaffDrawer = (key: string) => {
    setDrawerKey(key);
    setDrawerTab('overview');
  };

  const closeDrawer = () => setDrawerKey('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (opModal) setOpModal(null);
      else if (drawerKey) closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerKey, opModal]);

  const markPaid = async (id: string, payment_date?: string) => {
    const res = await fetch('/api/finance/salaries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'mark-paid', payment_date }),
    });
    if (res.ok) load();
    else {
      const body = await res.json().catch(() => ({}));
      setErr(body.error || 'تعذّر تسديد الراتب');
    }
  };

  const voidLine = async (id: string) => {
    if (!window.confirm('حذف هذا القيد؟ إن كان مصروفاً يُلغى من الخزينة أيضاً.')) return;
    const res = await fetch('/api/finance/salaries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'void' }),
    });
    if (res.ok) load();
    else {
      const body = await res.json().catch(() => ({}));
      setErr(body.error || 'تعذّر الحذف');
    }
  };

  const openCreateOp = (kind: 'salary' | 'advance') => {
    setOpForm({
      amount: '',
      period_year: today.year,
      period_month: today.month,
      note: kind === 'advance' ? 'تسبيق راتب' : '',
      pay_now: kind === 'advance',
      payment_date: todayISO(),
      method: 'CASH',
      kind,
    });
    setOpModal({ mode: 'create', kind });
  };

  const openEditOp = (line: Line) => {
    setOpForm({
      amount: String(line.amount || ''),
      period_year: line.period_year,
      period_month: line.period_month,
      note: line.note || '',
      pay_now: false,
      payment_date: line.paid_at || todayISO(),
      method: 'CASH',
      kind: String(line.kind || '').toLowerCase() === 'advance' ? 'advance' : 'salary',
    });
    setOpModal({ mode: 'edit', line });
  };

  const submitOp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStaff || !opModal) return;
    const amount = Number(opForm.amount);
    if (!amount) {
      setErr('المبلغ مطلوب');
      return;
    }
    setOpBusy(true);
    setErr('');
    try {
      if (opModal.mode === 'create') {
        const res = await fetch('/api/finance/salaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_name: activeStaff.staff_name,
            morshid_id: activeStaff.morshid_id || null,
            period_year: opForm.period_year,
            period_month: opForm.period_month,
            amount,
            note: opForm.note,
            kind: opModal.kind,
            pay_now: opForm.pay_now,
            payment_date: opForm.payment_date,
            method: opForm.method,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'تعذّر الحفظ');
      } else {
        const res = await fetch('/api/finance/salaries', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: opModal.line.id,
            action: 'update',
            amount,
            period_year: opForm.period_year,
            period_month: opForm.period_month,
            note: opForm.note,
            kind: opForm.kind,
            payment_date: opForm.payment_date,
            method: opForm.method,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'تعذّر التعديل');
      }
      setOpModal(null);
      load();
    } catch (ex: any) {
      setErr(ex.message || 'خطأ');
    } finally {
      setOpBusy(false);
    }
  };

  const years = data?.years?.length ? data.years : [today.year];
  const scopeLabel = recapPeriod
    ? `فترة الملخص ${recapFrom} → ${recapTo}`
    : scope === 'all'
      ? 'كل الفترات'
      : scope === 'month'
        ? `${monthLabel(today.month)} ${today.year}`
        : scope === 'year'
          ? String(year)
          : `${monthLabel(fromMonth)} – ${monthLabel(toMonth)} ${year}`;

  /* ── Salary entry card for the detail drawer ── */
  const salaryEntryCard = (l: Line, showActions = true) => {
    const isPaid = l.status === 'PAID';
    const isAdvance = String(l.kind || '').toLowerCase() === 'advance';
    return (
      <div
        key={l.id}
        className="payroll-entry-card"
        style={{
          background: 'var(--md-surface)',
          border: `1px solid ${isPaid ? 'var(--md-outline-variant)' : 'var(--md-warning-container)'}`,
          borderRadius: 'var(--md-shape-md)',
          padding: '14px 16px',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Top row: month + status badge */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="font-extrabold text-sm">
            {monthLabel(l.period_month)} {l.period_year}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isAdvance ? 'bg-sky-500/15 text-sky-800' : 'bg-violet-500/10 text-violet-800'
              }`}
            >
              {kindLabel(l.kind)}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isPaid
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : 'bg-amber-500/15 text-amber-800'
              }`}
            >
              {isPaid ? '✓ مصروف' : '◷ معلّق'}
            </span>
          </div>
        </div>

        {/* Amount row */}
        <div className="text-lg font-black tabular-nums" style={{ letterSpacing: '-0.02em' }}>
          {fmtMoney(l.amount)}
        </div>

        {/* Meta row: date + note */}
        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[12px] opacity-65">
          {l.paid_at ? (
            <span className="tabular-nums flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 12.5A5.5 5.5 0 1 1 8 2.5a5.5 5.5 0 0 1 0 11ZM8.5 4h-1v4.25l3.5 2.1.5-.82-3-1.78V4Z"/></svg>
              {l.paid_at}
            </span>
          ) : null}
          {l.note ? (
            <span className="truncate max-w-[14rem]" title={l.note}>
              {l.note}
            </span>
          ) : null}
        </div>

        {/* Actions row */}
        {showActions && (
          <div className="flex items-center gap-1.5 mt-3 pt-2.5" style={{ borderTop: '1px solid var(--md-outline-variant)' }}>
            <button
              type="button"
              className="payroll-action-btn"
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.6875rem',
                fontWeight: 800,
                cursor: 'pointer',
                border: '1px solid var(--md-outline-variant)',
                background: 'var(--md-surface-container-low)',
                color: 'inherit',
                transition: 'background 0.12s',
              }}
              onClick={() => openEditOp(l)}
            >
              ✎ تعديل
            </button>
            {!isPaid && (
              <button
                type="button"
                className="payroll-action-btn"
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'var(--md-success)',
                  color: '#fff',
                  transition: 'opacity 0.12s',
                }}
                onClick={() => markPaid(l.id)}
              >
                ✓ تسديد
              </button>
            )}
            <button
              type="button"
              className="payroll-action-btn"
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.6875rem',
                fontWeight: 800,
                cursor: 'pointer',
                border: 'none',
                background: 'rgba(244,63,94,0.1)',
                color: '#be123c',
                marginInlineStart: 'auto',
                transition: 'background 0.12s',
              }}
              onClick={() => voidLine(l.id)}
            >
              حذف
            </button>
          </div>
        )}
      </div>
    );
  };

  /* ── Salary entries list (card-based) ── */
  const salaryCardList = (s: Staff, limit?: number) => {
    const entries = limit ? s.lines.slice(0, limit) : s.lines;
    if (entries.length === 0) {
      return (
        <div
          className="text-center py-8 text-sm opacity-50"
          style={{ background: 'var(--md-surface-container-low)', borderRadius: 'var(--md-shape-md)' }}
        >
          لا توجد عمليات
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {entries.map((l) => salaryEntryCard(l))}
        {/* Total summary bar */}
        {!limit && s.lines.length > 0 && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 font-black text-sm"
            style={{
              background: 'var(--md-on-surface)',
              color: 'var(--md-surface)',
              borderRadius: 'var(--md-shape-md)',
            }}
          >
            <span>الإجمالي · {fmtCount(s.lines.length)} قيد</span>
            <span className="tabular-nums">{fmtMoney(s.total)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PanelHeader
        compact
        title="الرواتب"
        action={
          <AcctPrintButton
            label="معاينة / طباعة"
            onClick={() => router.push(`/portal/payroll/print?${query}`)}
          />
        }
      />

      <FilterDrawer activeCount={scope !== 'month' ? 1 : 0}>
        <div className="flex flex-wrap items-center gap-1.5">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`acct-chip ${scope === s.id ? 'acct-chip-active' : ''}`}
              onClick={() => {
                setScope(s.id);
                closeDrawer();
              }}
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
              {years.map((y) => (
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
      </FilterDrawer>

      {recapPeriod ? (
        <p className="text-xs font-bold acct-top-subtitle px-1">
          نفس فترة الملخص — «إجمالي الرواتب» = بند الرواتب في حساب النتيجة
        </p>
      ) : null}

      <Disclosure title={`ملخص الرواتب · ${scopeLabel}`} defaultOpen={false}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Kpi label="إجمالي الرواتب" value={data?.total} tone="text-violet-700" />
          <Kpi label="المصروف فعلياً" value={data?.paid_total} tone="text-emerald-700" />
          <Kpi label="المعلّق" value={data?.pending_total} tone="text-amber-700" />
          <Kpi label="الموظفون" value={data ? fmtCount(data.staff_count) : '—'} />
        </div>
      </Disclosure>

      {err && !drawerKey ? <p className="text-xs font-bold text-rose-600">{err}</p> : null}

      <SlideList>
        {(data?.staff || []).map((s, i) => (
          <SlideListItem
            key={s.key}
            index={i}
            open={drawerKey === s.key}
            expandable={false}
            onToggle={() => openStaffDrawer(s.key)}
            accent={s.pending_total > 0 ? 'due' : 'settled'}
            row={
              <>
                <EntityAvatar
                  name={s.staff_name}
                  imageUrl={s.staff_photo}
                  variant="client"
                  size="sm"
                  className="shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-extrabold text-sm truncate block">{s.staff_name}</span>
                  <span className="text-[11px] font-bold opacity-60 mt-0.5">
                    {fmtCount(s.months)} شهر
                    {s.pending_months > 0 ? ` · ${fmtCount(s.pending_months)} معلّق` : ''}
                  </span>
                </span>
                {s.pending_total > 0 && (
                  <span className="hidden sm:inline text-[11px] font-bold text-amber-700 tabular-nums shrink-0">
                    معلّق {fmtMoney(s.pending_total)}
                  </span>
                )}
                <span className="text-sm font-black tabular-nums shrink-0 text-violet-700">{fmtMoney(s.total)}</span>
              </>
            }
          />
        ))}

        {data && data.staff.length === 0 ? <SlideListEmpty>لا رواتب في هذه الفترة</SlideListEmpty> : null}

        {data && data.staff.length > 0 ? (
          <SlideListFooter>
            <span className="flex-1 text-sm">
              الإجمالي
              <span className="text-[11px] font-bold opacity-55">
                {' '}
                · {fmtCount(data.staff_count)} موظف · {fmtCount(data.lines_count)} قيد
              </span>
            </span>
            <span className="text-sm tabular-nums text-violet-700">{fmtMoney(data.total)}</span>
          </SlideListFooter>
        ) : null}
      </SlideList>

      {/* ══════════════════════════════════════════════════════════════
         REDESIGNED STAFF SALARY DETAIL DRAWER
         — Clean "Personal Account Manager" layout
         ══════════════════════════════════════════════════════════════ */}
      {drawerKey && activeStaff && (
        <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer border-0"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
            aria-label="إغلاق"
            onClick={closeDrawer}
          />

          <aside
            className="relative z-10 h-full w-full max-w-[620px] flex flex-col acct-drawer-panel"
            style={{
              background: 'var(--md-surface-dim)',
              boxShadow: '-20px 0 60px rgba(0,0,0,0.18)',
              animation: 'payroll-slide-in 0.25s ease-out',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-drawer-title"
          >
            {/* ─── SECTION 1: Profile header ─── */}
            <div
              style={{
                background: 'var(--md-surface)',
                borderBottom: '1px solid var(--md-outline-variant)',
                flexShrink: 0,
              }}
            >
              {/* Top bar with close + print */}
              <div className="flex items-center justify-between px-5 pt-4 pb-0">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex items-center gap-1.5 text-xs font-bold opacity-60 cursor-pointer"
                  style={{ background: 'none', border: 'none', color: 'inherit' }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                    <path d="M12.3 4.3a.75.75 0 0 0-1.06-1.06L8 6.44 4.76 3.24a.75.75 0 0 0-1.06 1.06L6.94 7.5 3.7 10.74a.75.75 0 1 0 1.06 1.06L8 8.56l3.24 3.24a.75.75 0 0 0 1.06-1.06L9.06 7.5l3.24-3.2Z"/>
                  </svg>
                  إغلاق
                </button>
                <AcctPrintButton
                  label="طباعة"
                  onClick={() => router.push(`/portal/payroll/print?${query}${query ? '&' : ''}staff=${encodeURIComponent(activeStaff.key)}`)}
                />
              </div>

              {/* Profile identity */}
              <div className="flex items-center gap-4 px-5 pt-4 pb-3">
                <EntityAvatar
                  name={activeStaff.staff_name}
                  imageUrl={activeStaff.staff_photo}
                  variant="client"
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <h4
                    id="staff-drawer-title"
                    className="text-lg font-black truncate"
                    style={{ lineHeight: 1.3 }}
                  >
                    {activeStaff.staff_name}
                  </h4>
                  <div className="text-[11px] font-bold opacity-55 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {activeStaff.morshid_id ? (
                      <span className="font-mono">{activeStaff.morshid_id}</span>
                    ) : null}
                    <span>{fmtCount(activeStaff.months)} شهر في الفترة</span>
                    {activeStaff.last_paid_at ? (
                      <span>· آخر صرف {activeStaff.last_paid_at}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* ─── SECTION 2: Financial summary ─── */}
              <div
                className="grid gap-2 px-5 pb-4"
                style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
              >
                <button
                  type="button"
                  className="payroll-kpi-card"
                  onClick={() => setDrawerTab('months')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '12px 14px',
                    borderRadius: 'var(--md-shape-md)',
                    border: '1px solid var(--md-outline-variant)',
                    background: 'var(--md-surface-container-low)',
                    cursor: 'pointer',
                    textAlign: 'start',
                    transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
                  }}
                >
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, opacity: 0.6 }}>إجمالي الفترة</span>
                  <span className="tabular-nums" style={{ fontSize: '1.05rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                    {fmtMoney(activeStaff.total)}
                  </span>
                </button>

                <button
                  type="button"
                  className="payroll-kpi-card"
                  onClick={() => setDrawerTab('months')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '12px 14px',
                    borderRadius: 'var(--md-shape-md)',
                    border: '1px solid var(--md-outline-variant)',
                    background: 'var(--md-success-container)',
                    cursor: 'pointer',
                    textAlign: 'start',
                    transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
                  }}
                >
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, opacity: 0.6 }}>المصروف</span>
                  <span className="tabular-nums text-emerald-700" style={{ fontSize: '1.05rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                    {fmtMoney(activeStaff.paid_total)}
                  </span>
                </button>

                <button
                  type="button"
                  className="payroll-kpi-card"
                  onClick={() => setDrawerTab('months')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '12px 14px',
                    borderRadius: 'var(--md-shape-md)',
                    border: `1px solid ${activeStaff.pending_total > 0 ? 'var(--md-warning)' : 'var(--md-outline-variant)'}`,
                    background: activeStaff.pending_total > 0 ? 'var(--md-warning-container)' : 'var(--md-surface-container-low)',
                    cursor: 'pointer',
                    textAlign: 'start',
                    transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
                  }}
                >
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, opacity: 0.6 }}>المعلّق</span>
                  <span className="tabular-nums text-amber-700" style={{ fontSize: '1.05rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                    {fmtMoney(activeStaff.pending_total)}
                  </span>
                </button>
              </div>

              {/* ─── SECTION 3: Actions ─── */}
              <div className="flex items-stretch gap-2 px-5 pb-4">
                <button
                  type="button"
                  onClick={() => openCreateOp('salary')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
                  style={{
                    background: 'var(--md-primary)',
                    color: 'var(--md-on-primary)',
                    border: 'none',
                    transition: 'opacity 0.12s',
                  }}
                >
                  + قيد راتب
                </button>
                <button
                  type="button"
                  onClick={() => openCreateOp('advance')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
                  style={{
                    background: 'var(--md-surface-container)',
                    color: 'inherit',
                    border: '1px solid var(--md-outline-variant)',
                    transition: 'background 0.12s',
                  }}
                >
                  تسبيق راتب
                </button>
                {activeStaff.pending_total > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = activeStaff.lines.find((l) => l.status !== 'PAID');
                      if (next) void markPaid(next.id);
                      else setDrawerTab('months');
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
                    style={{
                      background: 'var(--md-success)',
                      color: '#fff',
                      border: 'none',
                      transition: 'opacity 0.12s',
                    }}
                  >
                    ✓ تسديد معلّق
                  </button>
                )}
              </div>

              {/* ─── Tab bar ─── */}
              <div
                className="flex px-5 gap-0"
                style={{ borderTop: '1px solid var(--md-surface-container-low)' }}
                role="tablist"
              >
                {DRAWER_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={drawerTab === t.id}
                    onClick={() => setDrawerTab(t.id)}
                    style={{
                      padding: '12px 18px',
                      fontSize: '0.8125rem',
                      fontWeight: 800,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: drawerTab === t.id ? '2.5px solid var(--md-primary)' : '2.5px solid transparent',
                      color: drawerTab === t.id ? 'var(--md-primary)' : 'inherit',
                      opacity: drawerTab === t.id ? 1 : 0.55,
                      cursor: 'pointer',
                      transition: 'color 0.15s, opacity 0.15s, border-color 0.15s',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── SECTION 4: Scrollable body ─── */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {err ? (
                <div
                  className="text-xs font-bold px-3 py-2 rounded-lg"
                  style={{ background: 'var(--md-error-container)', color: 'var(--md-on-error-container)' }}
                >
                  {err}
                </div>
              ) : null}

              {drawerTab === 'overview' && (
                <div className="space-y-5" style={{ animation: 'payroll-fade-in 0.2s ease-out' }}>
                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <Stat
                      label="متوسط الشهر"
                      value={fmtMoney(activeStaff.months ? Math.round(activeStaff.total / activeStaff.months) : 0)}
                    />
                    <Stat label="أشهر مصروفة" value={fmtCount(activeStaff.paid_months)} />
                    <Stat
                      label="أشهر معلّقة"
                      value={fmtCount(activeStaff.pending_months)}
                      tone="text-amber-700"
                    />
                  </div>

                  {/* Pending alert */}
                  {activeStaff.pending_total > 0 && (
                    <div
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                      style={{
                        background: 'var(--md-warning-container)',
                        border: '1px solid var(--md-warning)',
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>⚠</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-extrabold">رواتب معلّقة</span>
                        <span className="font-black tabular-nums mx-2 text-amber-700">
                          {fmtMoney(activeStaff.pending_total)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDrawerTab('months')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--md-primary)',
                          fontWeight: 800,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        عرض ←
                      </button>
                    </div>
                  )}

                  {/* Recent entries */}
                  <div>
                    <h5 className="text-sm font-black mb-3 opacity-60">آخر العمليات</h5>
                    {salaryCardList(activeStaff, 4)}
                    {activeStaff.lines.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setDrawerTab('months')}
                        className="w-full mt-2 py-2 text-sm font-bold cursor-pointer rounded-lg"
                        style={{
                          background: 'var(--md-surface-container-low)',
                          border: '1px solid var(--md-outline-variant)',
                          color: 'var(--md-primary)',
                          transition: 'background 0.12s',
                        }}
                      >
                        عرض كل العمليات ({fmtCount(activeStaff.lines.length)})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {drawerTab === 'months' && (
                <div style={{ animation: 'payroll-fade-in 0.2s ease-out' }}>
                  <h5 className="text-sm font-black mb-3 opacity-60">
                    كل العمليات · {fmtCount(activeStaff.lines.length)} قيد
                  </h5>
                  {salaryCardList(activeStaff)}
                </div>
              )}
            </div>
          </aside>

          {/* Inline animation keyframes */}
          <style>{`
            @keyframes payroll-slide-in {
              from { transform: translateX(40px); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
            @keyframes payroll-fade-in {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .payroll-kpi-card:hover {
              border-color: var(--md-primary) !important;
              transform: scale(0.98);
            }
            .payroll-action-btn:hover {
              opacity: 0.85;
              filter: brightness(1.05);
            }
            .payroll-entry-card:hover {
              box-shadow: var(--md-elevation-1);
            }
          `}</style>
        </div>
      )}

      {opModal && activeStaff && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" dir="rtl">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer border-0"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            aria-label="إغلاق"
            onClick={() => setOpModal(null)}
          />
          <form
            className="relative z-10 w-full sm:max-w-[440px]"
            style={{
              background: 'var(--md-surface)',
              borderRadius: '24px 24px 0 0',
              boxShadow: 'var(--md-elevation-3)',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              animation: 'payroll-modal-up 0.28s cubic-bezier(0.32,0.72,0,1)',
            }}
            onSubmit={submitOp}
          >
            {/* ── Drag indicator (mobile sheet feel) ── */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--md-outline-variant)' }} />
            </div>

            {/* ── Header ── */}
            <div
              className="px-6 pt-4 sm:pt-6 pb-4"
              style={{ borderBottom: '1px solid var(--md-outline-variant)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--md-shape-md)',
                    background: opModal.mode === 'edit'
                      ? 'var(--md-surface-container)'
                      : (opModal as any).kind === 'advance'
                        ? 'var(--md-primary-container)'
                        : 'var(--md-success-container)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '1.25rem',
                  }}
                >
                  {opModal.mode === 'edit' ? '✎' : (opModal as any).kind === 'advance' ? '⤓' : '+'}
                </div>
                <div className="min-w-0 flex-1">
                  <h5 style={{ fontSize: '1.125rem', fontWeight: 900, lineHeight: 1.3 }}>
                    {opModal.mode === 'edit'
                      ? 'تعديل العملية'
                      : (opModal as any).kind === 'advance'
                        ? 'تسبيق راتب'
                        : 'قيد راتب جديد'}
                  </h5>
                  <div className="flex items-center gap-2 mt-1" style={{ fontSize: '0.75rem', opacity: 0.55 }}>
                    <EntityAvatar
                      name={activeStaff.staff_name}
                      imageUrl={activeStaff.staff_photo}
                      variant="client"
                      size="xs"
                    />
                    <span className="truncate">{activeStaff.staff_name}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpModal(null)}
                  style={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--md-shape-full)',
                    background: 'var(--md-surface-container-low)',
                    border: 'none',
                    color: 'inherit',
                    opacity: 0.6,
                    cursor: 'pointer',
                    transition: 'opacity 0.12s, background 0.12s',
                  }}
                  aria-label="إغلاق"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                    <path d="M12.3 4.3a.75.75 0 0 0-1.06-1.06L8 6.44 4.76 3.24a.75.75 0 0 0-1.06 1.06L6.94 7.5 3.7 10.74a.75.75 0 1 0 1.06 1.06L8 8.56l3.24 3.24a.75.75 0 0 0 1.06-1.06L9.06 7.5l3.24-3.2Z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Scrollable form body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5" style={{ overscrollBehavior: 'contain' }}>
              <div className="space-y-5">

                {/* ▸ Amount section — hero field */}
                <div>
                  <div className="flex items-center gap-2 mb-2" style={{ fontSize: '0.6875rem', fontWeight: 800, opacity: 0.5, letterSpacing: '0.04em' }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8.75-3.25a.75.75 0 0 0-1.5 0v.56c-.87.19-1.75.76-1.75 1.94 0 1.36 1.28 1.83 2.17 2.12l.08.03c1 .32 1.5.56 1.5 1.1 0 .49-.52.88-1.25.88-.82 0-1.22-.38-1.4-.64a.75.75 0 1 0-1.24.84C5.74 12.6 6.58 13.12 7.25 13.3v.45a.75.75 0 0 0 1.5 0v-.52c.97-.21 1.75-.87 1.75-2.02 0-1.44-1.28-1.87-2.2-2.17l-.08-.03c-.98-.31-1.47-.56-1.47-1.06 0-.37.41-.76 1.25-.76.6 0 1.01.24 1.22.46a.75.75 0 0 0 1.08-1.04c-.37-.39-.93-.73-1.55-.87v-.49Z"/></svg>
                    المبلغ
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'var(--md-surface-container-low)',
                      borderRadius: 'var(--md-shape-md)',
                      border: '1.5px solid var(--md-outline-variant)',
                      padding: '4px 14px 4px 4px',
                      transition: 'border-color 0.15s',
                    }}
                    className="payroll-amount-field"
                  >
                    <input
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={opForm.amount}
                      onChange={(e) => setOpForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '1.5rem',
                        fontWeight: 900,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.03em',
                        color: 'inherit',
                        padding: '10px 0',
                        minWidth: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        opacity: 0.45,
                        whiteSpace: 'nowrap',
                        padding: '6px 10px',
                        borderRadius: 'var(--md-shape-sm)',
                        background: 'var(--md-surface-container)',
                      }}
                    >
                      دج
                    </span>
                  </div>
                </div>

                {/* ▸ Period section */}
                <div>
                  <div className="flex items-center gap-2 mb-2" style={{ fontSize: '0.6875rem', fontWeight: 800, opacity: 0.5, letterSpacing: '0.04em' }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2H13A1.5 1.5 0 0 1 14.5 3.5v9a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 12.5v-9A1.5 1.5 0 0 1 3 2h1V.75A.75.75 0 0 1 4.75 0ZM3 5.5v7h10v-7H3Z"/></svg>
                    الفترة
                  </div>
                  <div
                    className="grid grid-cols-2 gap-0"
                    style={{
                      borderRadius: 'var(--md-shape-md)',
                      border: '1px solid var(--md-outline-variant)',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '10px 14px', borderInlineEnd: '1px solid var(--md-outline-variant)' }}>
                      <div style={{ fontSize: '0.625rem', fontWeight: 700, opacity: 0.5, marginBottom: 4 }}>السنة</div>
                      <input
                        type="number"
                        required
                        value={opForm.period_year}
                        onChange={(e) => setOpForm((f) => ({ ...f, period_year: Number(e.target.value) }))}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontSize: '0.9375rem',
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                          color: 'inherit',
                          padding: 0,
                        }}
                      />
                    </div>
                    <div style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: '0.625rem', fontWeight: 700, opacity: 0.5, marginBottom: 4 }}>الشهر</div>
                      <select
                        value={opForm.period_month}
                        onChange={(e) => setOpForm((f) => ({ ...f, period_month: Number(e.target.value) }))}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontSize: '0.9375rem',
                          fontWeight: 800,
                          color: 'inherit',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                      >
                        {MONTHS.map((m, i) => (
                          <option key={m} value={i + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ▸ Instant pay toggle */}
                {opModal.mode === 'create' && (
                  <button
                    type="button"
                    onClick={() => setOpForm((f) => ({ ...f, pay_now: !f.pay_now }))}
                    className="payroll-toggle-row"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 'var(--md-shape-md)',
                      border: `1.5px solid ${opForm.pay_now ? 'var(--md-primary)' : 'var(--md-outline-variant)'}`,
                      background: opForm.pay_now ? 'var(--md-primary-container)' : 'var(--md-surface-container-low)',
                      cursor: 'pointer',
                      textAlign: 'start',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 20,
                        borderRadius: 99,
                        background: opForm.pay_now ? 'var(--md-primary)' : 'var(--md-outline)',
                        position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: 2,
                          transition: 'inset-inline-start 0.2s',
                          insetInlineStart: opForm.pay_now ? 18 : 2,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 800 }}>صرف فوري من الخزينة</div>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, opacity: 0.5, marginTop: 1 }}>
                        {opForm.pay_now ? 'سيُخصم المبلغ مباشرة' : 'يُسجَّل كراتب معلّق'}
                      </div>
                    </div>
                  </button>
                )}

                {/* ▸ Payment details (conditional) */}
                {((opModal.mode === 'edit' && opModal.line.status === 'PAID') ||
                  (opModal.mode === 'create' && opForm.pay_now)) && (
                  <div
                    style={{
                      borderRadius: 'var(--md-shape-md)',
                      border: '1px solid var(--md-outline-variant)',
                      overflow: 'hidden',
                      animation: 'payroll-fade-in 0.2s ease-out',
                    }}
                  >
                    <div
                      className="flex items-center gap-2 px-3.5 py-2"
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        opacity: 0.5,
                        letterSpacing: '0.04em',
                        background: 'var(--md-surface-container-low)',
                        borderBottom: '1px solid var(--md-outline-variant)',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M1.5 3A1.5 1.5 0 0 1 3 1.5h10A1.5 1.5 0 0 1 14.5 3v2.5H1.5V3Zm0 4v6A1.5 1.5 0 0 0 3 14.5h10a1.5 1.5 0 0 0 1.5-1.5V7h-13Zm3.75 3a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5Z"/></svg>
                      تفاصيل الصرف
                    </div>
                    <div className="grid grid-cols-2 gap-0">
                      <div style={{ padding: '10px 14px', borderInlineEnd: '1px solid var(--md-outline-variant)' }}>
                        <div style={{ fontSize: '0.625rem', fontWeight: 700, opacity: 0.5, marginBottom: 4 }}>تاريخ الصرف</div>
                        <input
                          type="date"
                          value={opForm.payment_date}
                          onChange={(e) => setOpForm((f) => ({ ...f, payment_date: e.target.value }))}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color: 'inherit',
                            padding: 0,
                            cursor: 'pointer',
                          }}
                        />
                      </div>
                      <div style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.625rem', fontWeight: 700, opacity: 0.5, marginBottom: 4 }}>طريقة الدفع</div>
                        <select
                          value={opForm.method}
                          onChange={(e) => setOpForm((f) => ({ ...f, method: e.target.value }))}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            color: 'inherit',
                            padding: 0,
                            cursor: 'pointer',
                          }}
                        >
                          {PAY_METHODS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* ▸ Kind selector (edit mode only) */}
                {opModal.mode === 'edit' && (
                  <div>
                    <div className="flex items-center gap-2 mb-2" style={{ fontSize: '0.6875rem', fontWeight: 800, opacity: 0.5, letterSpacing: '0.04em' }}>
                      النوع
                    </div>
                    <div
                      className="grid grid-cols-2 gap-0"
                      style={{
                        borderRadius: 'var(--md-shape-md)',
                        border: '1px solid var(--md-outline-variant)',
                        overflow: 'hidden',
                      }}
                    >
                      {(['salary', 'advance'] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setOpForm((f) => ({ ...f, kind: k }))}
                          style={{
                            padding: '10px 14px',
                            background: opForm.kind === k ? 'var(--md-primary-container)' : 'transparent',
                            border: 'none',
                            borderInlineEnd: k === 'salary' ? '1px solid var(--md-outline-variant)' : 'none',
                            fontSize: '0.8125rem',
                            fontWeight: opForm.kind === k ? 900 : 600,
                            color: opForm.kind === k ? 'var(--md-on-primary-container)' : 'inherit',
                            opacity: opForm.kind === k ? 1 : 0.6,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {k === 'salary' ? 'راتب' : 'تسبيق'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ▸ Note */}
                <div>
                  <div className="flex items-center gap-2 mb-2" style={{ fontSize: '0.6875rem', fontWeight: 800, opacity: 0.5, letterSpacing: '0.04em' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V1.75Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H1.75ZM3.5 3.5a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Zm0 4a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5Z"/></svg>
                    ملاحظة
                  </div>
                  <input
                    type="text"
                    value={opForm.note}
                    onChange={(e) => setOpForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="ملاحظة اختيارية…"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--md-shape-md)',
                      border: '1px solid var(--md-outline-variant)',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'inherit',
                      transition: 'border-color 0.15s',
                    }}
                    className="payroll-note-input"
                  />
                </div>
              </div>
            </div>

            {/* ── Footer actions ── */}
            <div
              className="px-6 py-4 flex items-center gap-2"
              style={{ borderTop: '1px solid var(--md-outline-variant)', flexShrink: 0 }}
            >
              <button
                type="submit"
                disabled={opBusy}
                className="flex-1 py-3 text-sm font-bold cursor-pointer disabled:opacity-50"
                style={{
                  background: 'var(--md-primary)',
                  color: 'var(--md-on-primary)',
                  border: 'none',
                  borderRadius: 'var(--md-shape-full)',
                  fontSize: '0.875rem',
                  fontWeight: 800,
                  transition: 'opacity 0.12s',
                }}
              >
                {opBusy ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="payroll-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />
                    جاري الحفظ…
                  </span>
                ) : (
                  opModal.mode === 'edit' ? 'حفظ التعديلات' : 'حفظ'
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpModal(null)}
                className="py-3 text-sm font-bold cursor-pointer"
                style={{
                  background: 'transparent',
                  color: 'inherit',
                  border: '1.5px solid var(--md-outline-variant)',
                  borderRadius: 'var(--md-shape-full)',
                  padding: '0 24px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  opacity: 0.7,
                  transition: 'opacity 0.12s',
                }}
              >
                إلغاء
              </button>
            </div>
          </form>

          {/* Modal-specific animations */}
          <style>{`
            @keyframes payroll-modal-up {
              from { transform: translateY(30px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @media (min-width: 640px) {
              @keyframes payroll-modal-up {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
              form.relative { border-radius: var(--md-shape-xl) !important; }
            }
            .payroll-amount-field:focus-within {
              border-color: var(--md-primary) !important;
            }
            .payroll-note-input:focus {
              border-color: var(--md-primary) !important;
            }
            .payroll-toggle-row:hover {
              filter: brightness(0.97);
            }
            @keyframes payroll-spin-kf {
              to { transform: rotate(360deg); }
            }
            .payroll-spin {
              animation: payroll-spin-kf 0.7s linear infinite;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--acct-input)' }}>
      <div className="text-[11px] font-bold opacity-60">{label}</div>
      <div className={`text-sm font-black tabular-nums mt-0.5 ${tone || ''}`}>{value}</div>
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtCount, fmtMoney } from './money';
import AcctPrintButton from './AcctPrintButton';
import { LEDGER_CATEGORIES, ledgerCategoryLabel } from '@/lib/finance-categories';
import {
  Alert,
  Disclosure,
  FilterDrawer,
  Kpi,
  SearchField,
  SlideList,
  SlideListEmpty,
  SlideListItem,
} from './ui';

type PostingLine = {
  scf_code: string;
  account_label: string;
  debit: number;
  credit: number;
};

type Line = {
  id: string;
  type: string;
  direction: string;
  amount: number;
  description: string;
  counterparty: string;
  method: string;
  category: string;
  entry_date: string;
  entry_kind?: string;
  account_id: string;
  account_name: string;
  accounts_summary?: string;
  postings?: PostingLine[];
  debit: number;
  credit: number;
  balance: number;
};

type Day = {
  date: string;
  lines: Line[];
  debit: number;
  credit: number;
  net: number;
  closing: number;
  count: number;
};

type Journal = {
  days: Day[];
  opening: number;
  total_debit: number;
  total_credit: number;
  net: number;
  closing: number;
  count: number;
  accounts: { id: string; name_ar: string; kind: string }[];
};

const TYPE_LABEL: Record<string, string> = {
  EXPENSE: 'مصروف',
  PURCHASE: 'شراء',
  SERVICE_SPEND: 'خدمة',
  CASH_IN: 'مقبوضات',
  CASH_OUT: 'مدفوعات',
};

type PeriodId = 'today' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'today', label: 'اليوم' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'quarter', label: '3 أشهر' },
  { id: 'year', label: 'هذه السنة' },
  { id: 'all', label: 'الكل' },
  { id: 'custom', label: 'مخصص' },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

function rangeFor(period: PeriodId) {
  const now = new Date();
  const to = iso(now);
  if (period === 'today') return { from: to, to };
  if (period === 'month') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  if (period === 'quarter') return { from: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to };
  if (period === 'year') return { from: iso(new Date(now.getFullYear(), 0, 1)), to };
  return { from: '', to: '' };
}

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function dayLabel(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : WEEKDAYS[d.getDay()];
}

function postingsOf(line: Line): PostingLine[] {
  if (line.postings && line.postings.length > 0) return line.postings;
  return [
    {
      scf_code: '—',
      account_label: line.account_name || '—',
      debit: line.debit,
      credit: line.credit,
    },
  ];
}

function entrySums(postings: PostingLine[]) {
  const debit = postings.reduce((s, p) => s + (Number(p.debit) || 0), 0);
  const credit = postings.reduce((s, p) => s + (Number(p.credit) || 0), 0);
  return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 };
}

export default function LedgerPanel() {
  const router = useRouter();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [period, setPeriod] = useState<PeriodId>('today');
  const [custom, setCustom] = useState(() => rangeFor('today'));
  const [catFilter, setCatFilter] = useState('all');
  const [q, setQ] = useState('');
  const [openDays, setOpenDays] = useState<string[]>([]);
  const [err, setErr] = useState('');

  const range = period === 'custom' ? custom : rangeFor(period);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    if (catFilter !== 'all') params.set('category', catFilter);
    if (q.trim()) params.set('q', q.trim());
    fetch(`/api/finance/ledger/journal?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('تعذر تحميل اليومية'))))
      .then((d: Journal) => {
        setJournal(d);
        const today = iso(new Date());
        const autoOpen = new Set<string>();
        for (const day of d.days.slice(0, 2)) autoOpen.add(day.date);
        if (d.days.some((x) => x.date === today)) autoOpen.add(today);
        setOpenDays((cur) => [...new Set([...autoOpen, ...cur])]);
      })
      .catch((e) => setErr(e.message || 'خطأ'));
  }, [range.from, range.to, catFilter, q]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = (date: string) =>
    setOpenDays((cur) => (cur.includes(date) ? cur.filter((d) => d !== date) : [...cur, date]));

  const filterCount =
    (catFilter !== 'all' ? 1 : 0) +
    (period !== 'today' ? 1 : 0) +
    (q.trim() ? 1 : 0);

  const openPrint = () => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    if (catFilter !== 'all') params.set('category', catFilter);
    if (q.trim()) params.set('q', q.trim());
    router.push(`/portal/ledger/print?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs acct-top-subtitle px-1">
          القيود تُرحَّل من الموردين والرواتب والمداخيل والخدمات. كل عملية قيد مزدوج: مدين ودائن، والمجموعان متساويان.
        </p>
        <AcctPrintButton label="معاينة / طباعة" onClick={openPrint} disabled={!journal} />
      </div>

      <SearchField value={q} onChange={setQ} placeholder="بحث في البيان أو الطرف…" />

      <FilterDrawer
        activeCount={filterCount}
        onClear={
          filterCount
            ? () => {
                setPeriod('today');
                setCatFilter('all');
                setQ('');
                setOpenDays([]);
              }
            : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`acct-chip ${period === p.id ? 'acct-chip-active' : ''}`}
              onClick={() => {
                setPeriod(p.id);
                setOpenDays([]);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-xs font-medium">
              من
              <input
                type="date"
                className="acct-input block mt-1 text-sm"
                value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium">
              إلى
              <input
                type="date"
                className="acct-input block mt-1 text-sm"
                value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              />
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`acct-chip ${catFilter === 'all' ? 'acct-chip-active' : ''}`}
            onClick={() => setCatFilter('all')}
          >
            كل التصنيفات
          </button>
          {LEDGER_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`acct-chip ${catFilter === c.id ? 'acct-chip-active' : ''}`}
              onClick={() => setCatFilter(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </FilterDrawer>

      {err && <Alert tone="error">{err}</Alert>}

      <Disclosure title="ملخص الفترة" defaultOpen={false}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <Kpi label="رصيد افتتاحي" value={journal?.opening} />
          <Kpi label="إجمالي المدين" value={journal?.total_debit} tone="text-emerald-700" />
          <Kpi label="إجمالي الدائن" value={journal?.total_credit} tone="text-rose-600" />
          <Kpi
            label="حركة الفترة"
            value={journal?.net}
            tone={(journal?.net ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}
          />
          <Kpi label="رصيد ختامي" value={journal?.closing} tone="text-sky-700" />
        </div>
      </Disclosure>

      <SlideList>
        {(journal?.days || []).map((day, i) => {
          const open = openDays.includes(day.date);
          const dayTotals = day.lines.reduce(
            (sum, line) => {
              const totals = entrySums(postingsOf(line));
              sum.debit += totals.debit;
              sum.credit += totals.credit;
              if (!totals.balanced) sum.unbalanced += 1;
              return sum;
            },
            { debit: 0, credit: 0, unbalanced: 0 }
          );
          const dayBalanced = dayTotals.unbalanced === 0;
          return (
            <SlideListItem
              key={day.date}
              index={i}
              open={open}
              onToggle={() => toggleDay(day.date)}
              accent={dayBalanced ? 'settled' : 'due'}
              row={
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold tabular-nums">{day.date}</span>
                    <span className="block text-[10px] font-bold opacity-60 mt-0.5">
                      {dayLabel(day.date)} · {fmtCount(day.count)} قيد
                    </span>
                  </span>
                  <span className="hidden sm:block text-[11px] acct-journal-debit font-bold tabular-nums shrink-0">
                    مدين {fmtMoney(dayTotals.debit)}
                  </span>
                  <span className="hidden sm:block text-[11px] acct-journal-credit font-bold tabular-nums shrink-0">
                    دائن {fmtMoney(dayTotals.credit)}
                  </span>
                  <span className={`acct-journal-balance ${dayBalanced ? 'is-ok' : 'is-bad'}`}>
                    {dayBalanced ? 'متوازن' : 'غير متوازن'}
                  </span>
                </>
              }
            >
              <div className="acct-journal-day">
                {day.lines.map((line) => {
                  const postings = postingsOf(line);
                  const totals = entrySums(postings);
                  return (
                    <article
                      key={line.id}
                      className={`acct-journal-entry${totals.balanced ? '' : ' is-unbalanced'}`}
                    >
                      <header className="acct-journal-entry-head">
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold leading-relaxed whitespace-normal break-words">
                            {line.description || line.counterparty || TYPE_LABEL[line.type] || line.type}
                          </div>
                          {line.counterparty && line.description ? (
                            <div className="text-[10px] opacity-50 mt-0.5">{line.counterparty}</div>
                          ) : null}
                          {line.entry_kind === 'accrual' ? (
                            <div className="text-[10px] font-bold text-amber-800 mt-0.5">
                              قيد استحقاق (لا حركة خزينة)
                            </div>
                          ) : null}
                        </div>
                        <span className="acct-badge shrink-0">{ledgerCategoryLabel(line.category)}</span>
                        <span className={`acct-journal-balance ${totals.balanced ? 'is-ok' : 'is-bad'}`}>
                          {totals.balanced ? 'متوازن' : 'غير متوازن'}
                        </span>
                      </header>
                      <table>
                        <thead>
                          <tr>
                            <th>الحساب (SCF)</th>
                            <th className="acct-journal-debit">مدين</th>
                            <th className="acct-journal-credit">دائن</th>
                          </tr>
                        </thead>
                        <tbody>
                          {postings.map((posting, idx) => (
                            <tr key={`${line.id}-${posting.scf_code}-${idx}`}>
                              <td className="text-[11px]">
                                <span className="font-mono font-bold">{posting.scf_code}</span>
                                <span className="block opacity-80">
                                  {posting.account_label.replace(/^\d+\s*—\s*/, '')}
                                </span>
                              </td>
                              <td className="font-bold tabular-nums acct-journal-debit">
                                {posting.debit ? fmtMoney(posting.debit) : ''}
                              </td>
                              <td className="font-bold tabular-nums acct-journal-credit">
                                {posting.credit ? fmtMoney(posting.credit) : ''}
                              </td>
                            </tr>
                          ))}
                          <tr className="acct-journal-entry-total">
                            <td>مجموع القيد</td>
                            <td className="tabular-nums acct-journal-debit">{fmtMoney(totals.debit)}</td>
                            <td className="tabular-nums acct-journal-credit">{fmtMoney(totals.credit)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </article>
                  );
                })}
              </div>
            </SlideListItem>
          );
        })}
        {journal && journal.days.length === 0 ? <SlideListEmpty>لا قيود في هذه الفترة</SlideListEmpty> : null}
      </SlideList>
    </div>
  );
}


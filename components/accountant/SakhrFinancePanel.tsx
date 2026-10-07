'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, ArrowLeft } from 'lucide-react';
import { fmtMoney } from './money';
import { FilterBar, PanelHeader } from './ui';
import { TRIP_TYPES, tripTypeLabel } from '@/lib/finance-categories';
import type { AccountantSection } from '../dashboards/AccountantDashboard';

type Period = 'month' | 'quarter' | 'year' | 'all';

type Answer = {
  intent: string;
  question: string;
  headline: string;
  lines: { label: string; value: string; tone?: 'good' | 'bad' | 'warn' }[];
  note?: string;
  area?: string;
  period: { id: Period; label: string };
  trip_type?: string | null;
  matched: boolean;
};

type Brief = {
  period: { id: Period; label: string };
  income: number;
  spending: number;
  net: number;
  treasury_total: number;
  client_debt: number;
  supplier_debt: number;
  assets_cost: number;
  overdue_suppliers: number;
  due_soon_suppliers: number;
  paid_suppliers: number;
};

const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'هذا الشهر' },
  { id: 'quarter', label: 'هذا الفصل' },
  { id: 'year', label: 'هذه السنة' },
  { id: 'all', label: 'كل الفترات' },
];

const AREA_LABEL: Record<string, string> = {
  overview: 'الملخص',
  treasury: 'الخزينة',
  ledger: 'اليومية',
  receipts: 'المداخيل',
  suppliers: 'الموردون',
  payroll: 'الرواتب',
  services: 'الموردون — خدمات دورية',
  assets: 'الاستثمارات',
};

const toneClass = (tone?: string) =>
  tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-600' : tone === 'warn' ? 'text-amber-700' : '';

export default function SakhrFinancePanel({ onGo }: { onGo?: (section: AccountantSection) => void }) {
  const [period, setPeriod] = useState<Period>('month');
  const [trip, setTrip] = useState('');
  const [groups, setGroups] = useState<{ area: string; label: string; questions: string[] }[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [q, setQ] = useState('');
  const [history, setHistory] = useState<Answer[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/finance/ask?period=${period}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('تعذر تحميل بيانات صخر'))))
      .then((d) => {
        setGroups(d.questions || []);
        setBrief(d.brief || null);
      })
      .catch((e) => setErr(e.message || 'خطأ'));
  }, [period]);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || busy) return;
      setBusy(true);
      setErr('');
      try {
        const res = await fetch('/api/finance/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text, period, trip_type: trip || null }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErr(data.error || 'تعذّر تحليل السؤال');
          return;
        }
        setHistory((h) => [data as Answer, ...h].slice(0, 12));
        setQ('');
      } catch {
        setErr('تعذّر الاتصال بالخادم');
      } finally {
        setBusy(false);
      }
    },
    [busy, period, trip]
  );

  const briefLines = useMemo(() => {
    if (!brief) return [];
    return [
      { label: 'المداخيل', value: fmtMoney(brief.income), tone: 'good' },
      { label: 'المصروفات', value: fmtMoney(brief.spending), tone: 'bad' },
      {
        label: 'النتيجة',
        value: `${brief.net >= 0 ? '+' : '−'}${fmtMoney(Math.abs(brief.net))}`,
        tone: brief.net >= 0 ? 'good' : 'bad',
      },
      { label: 'الخزينة', value: fmtMoney(brief.treasury_total) },
      { label: 'مستحقات العملاء', value: fmtMoney(brief.client_debt), tone: 'warn' },
      { label: 'دين الموردين', value: fmtMoney(brief.supplier_debt), tone: 'bad' },
    ];
  }, [brief]);

  return (
    <div className="space-y-3">
      <PanelHeader compact title="صخر" />

      <FilterBar>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`acct-chip ${period === p.id ? 'acct-chip-active' : ''}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
          <span className="mx-1 opacity-30">|</span>
          <button
            type="button"
            className={`acct-chip ${!trip ? 'acct-chip-active' : ''}`}
            onClick={() => setTrip('')}
          >
            الكل
          </button>
          {TRIP_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`acct-chip ${trip === t.id ? 'acct-chip-active' : ''}`}
              onClick={() => setTrip(trip === t.id ? '' : t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(q);
          }}
        >
          <input
            className="acct-input flex-1 text-sm"
            placeholder="اكتب سؤالك… مثال: كم ندين للموردين المتأخرين؟"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !q.trim()}
            className="px-4 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-sm"
          >
            <Send className="w-3.5 h-3.5" />
            {busy ? '…' : 'اسأل'}
          </button>
        </form>

        {err && <p className="text-xs font-bold text-rose-600">{err}</p>}
      </FilterBar>

      {/* Live snapshot so the panel is useful before anything is asked */}
      {brief && (
        <div className="acct-card rounded-2xl p-3">
          <div className="text-[11px] font-bold opacity-60 mb-2">
            لمحة سريعة · {brief.period.label}
            {trip ? ` · ${tripTypeLabel(trip)}` : ''}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {briefLines.map((l) => (
              <div key={l.label} className="rounded-lg px-2.5 py-2" style={{ background: 'var(--acct-input)' }}>
                <div className="text-[10px] font-bold opacity-60">{l.label}</div>
                <div className={`text-xs font-black tabular-nums mt-0.5 ${toneClass(l.tone)}`}>{l.value}</div>
              </div>
            ))}
          </div>
          {(brief.overdue_suppliers > 0 || brief.due_soon_suppliers > 0) && (
            <p className="text-[11px] font-bold mt-2 text-amber-700">
              تنبيه: {brief.overdue_suppliers} مورد متأخر السداد و{brief.due_soon_suppliers} يستحق خلال أسبوع.
            </p>
          )}
        </div>
      )}

      {/* Answers, newest first */}
      {history.map((a, i) => (
        <div key={`${a.intent}-${i}`} className="acct-card rounded-2xl p-4 acct-fade-in">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] opacity-60 font-bold">{a.question}</p>
              <p className={`text-sm font-black mt-1 ${a.matched ? '' : 'text-amber-700'}`}>{a.headline}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="acct-badge">{a.period.label}</span>
              {a.trip_type && <span className="acct-badge">{tripTypeLabel(a.trip_type)}</span>}
            </div>
          </div>

          {a.lines.length > 0 && (
            <ul className="mt-3 divide-y" style={{ borderColor: 'var(--acct-border)' }}>
              {a.lines.map((l, idx) => (
                <li key={`${l.label}-${idx}`} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="text-[11px] font-bold opacity-75 min-w-0 truncate">{l.label}</span>
                  <span className={`text-xs font-black tabular-nums shrink-0 ${toneClass(l.tone)}`}>
                    {l.value}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {a.note && <p className="text-[11px] opacity-75 leading-relaxed mt-2.5">{a.note}</p>}

          {a.area && onGo && (
            <button
              type="button"
              onClick={() => onGo(a.area as AccountantSection)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg acct-muted text-[11px] font-bold cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              افتح {AREA_LABEL[a.area] || a.area}
            </button>
          )}
        </div>
      ))}

      {/* The questions accountants ask most, grouped by dashboard section */}
      <div className="acct-card rounded-2xl p-3 space-y-3">
        <div className="text-[11px] font-bold opacity-60">أسئلة جاهزة</div>
        {groups.map((g) => (
          <div key={g.area} className="space-y-1.5">
            <div className="text-[11px] font-black">{g.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.questions.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={busy}
                  className="acct-chip text-right disabled:opacity-50"
                  onClick={() => void ask(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useId, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  Wallet,
} from 'lucide-react';
import { fmtAmount } from '../money';
import { treasuryKindLabel } from '@/lib/finance-categories';

type TreasuryAccount = {
  id: string;
  name_ar: string;
  kind: string;
  bank_name?: string;
  balance: number;
  period_closing?: number;
};

type MonthPoint = { month: string; income: number; spending: number };
type CategoryPoint = { id: string; label: string; amount: number };

const MONTHS = ['جان', 'فيف', 'مار', 'أفر', 'ماي', 'جوان', 'جويل', 'أوت', 'سب', 'أكت', 'نوف', 'ديس'];

function monthLabel(key: string) {
  const m = Number(String(key).slice(5, 7));
  return MONTHS[m - 1] || key.slice(5, 7);
}

function compact(n: number) {
  const v = Number(n) || 0;
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1000) return `${sign}${Math.round(a / 1000)}K`;
  return `${sign}${Math.round(a)}`;
}

function money(n: number) {
  return fmtAmount(n);
}

/** Months from Jan of `year` through `to` (inclusive), merged with API buckets. */
function seriesForYear(year: number, to: string, monthly: MonthPoint[]): MonthPoint[] {
  const map = new Map(monthly.map((p) => [p.month, p]));
  const endMonth = Math.min(12, Number(String(to).slice(5, 7)) || 12);
  const out: MonthPoint[] = [];
  for (let m = 1; m <= endMonth; m += 1) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    out.push(map.get(key) || { month: key, income: 0, spending: 0 });
  }
  return out.length ? out : [{ month: `${year}-01`, income: 0, spending: 0 }];
}

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function RecapCharts({
  income,
  charges,
  result,
  year,
  periodTo,
  monthly,
  categories,
  accounts,
  treasuryTotal,
  refreshing = false,
  from,
  to,
  onFromChange,
  onToChange,
  onIncome,
  onCharges,
  onAccount,
}: {
  income: number;
  charges: number;
  result: number;
  year: number;
  periodTo: string;
  monthly: MonthPoint[];
  categories: CategoryPoint[];
  accounts: TreasuryAccount[];
  treasuryTotal: number;
  refreshing?: boolean;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onIncome: () => void;
  onCharges: () => void;
  onAccount: (id: string) => void;
}) {
  const uid = useId().replace(/:/g, '');

  const series = useMemo(() => {
    const built = seriesForYear(year, periodTo, monthly || []);
    if (built.every((p) => !p.income && !p.spending) && (income || charges)) {
      const last = built[built.length - 1];
      if (last) {
        last.income = income;
        last.spending = charges;
      }
    }
    return built;
  }, [year, periodTo, monthly, income, charges]);

  const maxY = Math.max(1, ...series.flatMap((p) => [p.income, p.spending]));
  const coverage = charges > 0 ? Math.round((income / charges) * 100) : income > 0 ? 100 : 0;
  const coverageRing = Math.min(100, Math.max(0, coverage));
  const top = useMemo(
    () => [...(categories || [])].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [categories]
  );
  const treas = accounts?.length ? accounts.slice(0, 2) : [];
  const topCompact = top.slice(0, 3);
  const trendPoints = series.filter((p) => p.income || p.spending);

  return (
    <section
      className={`acct-dash acct-dash-atlas${refreshing ? ' is-refreshing' : ''}`}
      dir="rtl"
      aria-label="رسوم الملخص"
      aria-busy={refreshing || undefined}
    >
      <header className="acct-dash-top">
        <div className="acct-dash-brand">
          <h2 className="acct-dash-title">الملخص المالي · {year}</h2>
          <p className="acct-dash-period" dir="ltr">
            {from} → {to}
          </p>
        </div>
        <div className="acct-dash-toolbar">
          <label className="acct-dash-date">
            <span>من</span>
            <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} />
          </label>
          <label className="acct-dash-date">
            <span>إلى</span>
            <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} />
          </label>
          {refreshing ? <span className="acct-dash-live">تحديث…</span> : null}
        </div>
      </header>

      <div className="acct-dash-hero">
        <aside className="acct-dash-kpis" aria-label="مؤشرات الملخص">
          <button type="button" className="acct-dash-kpi is-in text-right" onClick={onIncome}>
            <div className="flex items-center justify-between gap-2">
              <span>المداخيل</span>
              <div className="acct-dash-kpi-icon is-in">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <strong>{money(income)}</strong>
            <span className="acct-dash-kpi-meta">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              مقبوضات الوكالة
            </span>
          </button>

          <button type="button" className="acct-dash-kpi is-out text-right" onClick={onCharges}>
            <div className="flex items-center justify-between gap-2">
              <span>الأعباء</span>
              <div className="acct-dash-kpi-icon is-out">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <strong>{money(charges)}</strong>
            <span className="acct-dash-kpi-meta">
              <TrendingDown className="w-3 h-3 text-rose-600" />
              تكاليف ومشتريات
            </span>
          </button>

          <div className={`acct-dash-kpi is-net${result < 0 ? ' is-neg' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span>النتيجة الصافية</span>
              <div className="acct-dash-kpi-icon is-net">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <strong>{money(result)}</strong>
            <span className="acct-dash-kpi-meta">
              {result >= 0 ? 'فائض أرباح محاسبي' : 'عجز في الفترة'}
            </span>
          </div>

          <div className="acct-dash-kpi is-treasury">
            <div className="flex items-center justify-between gap-2">
              <span>الخزينة</span>
              <div className="acct-dash-kpi-icon is-treasury">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <strong>{money(treasuryTotal)}</strong>
            <span className="acct-dash-kpi-meta">رصيد البنوك والصناديق</span>
          </div>
        </aside>

        <article className="acct-dash-card acct-dash-main">
          <div className="acct-dash-card-head">
            <div>
              <h3>حركة المداخيل والأعباء</h3>
              <p className="acct-dash-hint">أعمدة = مداخيل · خط = أعباء · بالشهر</p>
            </div>
            <div className="acct-dash-legend">
              <span>
                <i className="is-bar" /> مداخيل
              </span>
              <span>
                <i className="is-line" /> أعباء
              </span>
            </div>
          </div>
          <div className="acct-dash-chart-frame">
            <ComboChart points={series} maxY={maxY} uid={uid} />
          </div>
        </article>
      </div>

      <div className="acct-dash-secondary">
        <article className="acct-dash-card acct-dash-highlight">
          <h3>تغطية الأعباء</h3>
          <p className="acct-dash-hint">نسبة المداخيل إلى الأعباء في الفترة</p>
          <Donut pct={coverageRing} label={`${coverage}%`} uid={uid} />
          <div className="acct-dash-split">
            <div>
              <span>مداخيل</span>
              <strong>{money(income)}</strong>
            </div>
            <div>
              <span>أعباء</span>
              <strong>{money(charges)}</strong>
            </div>
          </div>
        </article>

        <article className="acct-dash-card">
          <h3>اتجاه الفترة</h3>
          <div className="acct-dash-chart-frame is-mini">
            <MiniLine points={trendPoints.length ? trendPoints : series} />
          </div>
        </article>

        <article className="acct-dash-card">
          <h3>حسابات الخزينة</h3>
          {treas.length ? (
            <TreasuryList accounts={treas} onAccount={onAccount} />
          ) : (
            <p className="acct-dash-empty">لا حساب خزينة</p>
          )}
        </article>

        <article className="acct-dash-card">
          <h3>أكبر بنود الأعباء</h3>
          {topCompact.length ? (
            <CategoryBars items={topCompact} max={topCompact[0]?.amount || 1} />
          ) : (
            <p className="acct-dash-empty">لا أعباء في الفترة</p>
          )}
        </article>
      </div>
    </section>
  );
}

export function RecapChartsSkeleton() {
  return (
    <section className="acct-dash acct-dash-atlas" dir="rtl" aria-busy="true" aria-label="تحميل الملخص">
      <header className="acct-dash-top">
        <div className="acct-dash-brand">
          <div className="acct-dash-skel acct-dash-skel-line w-28 mb-2" />
          <div className="acct-dash-skel acct-dash-skel-line w-56 h-6" />
        </div>
      </header>
      <div className="acct-dash-hero">
        <aside className="acct-dash-kpis">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="acct-dash-kpi">
              <div className="acct-dash-skel acct-dash-skel-line w-16 mb-3" />
              <div className="acct-dash-skel acct-dash-skel-line w-28 h-7 mb-2" />
              <div className="acct-dash-skel acct-dash-skel-line w-20" />
            </div>
          ))}
        </aside>
        <article className="acct-dash-card acct-dash-main">
          <div className="acct-dash-skel acct-dash-skel-line w-40 mb-3" />
          <div className="acct-dash-skel acct-dash-skel-chart" />
        </article>
      </div>
    </section>
  );
}

function ComboChart({ points, maxY, uid }: { points: MonthPoint[]; maxY: number; uid: string }) {
  const w = 720;
  const h = 248;
  const left = 48;
  const right = 16;
  const top = 16;
  const bottom = 36;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const n = Math.max(points.length, 1);
  const step = plotW / n;
  const y = (v: number) => top + plotH - (Math.max(0, v) / maxY) * plotH;
  const linePts = points.map((p, i) => ({
    x: left + step * i + step / 2,
    y: y(p.spending),
  }));
  const line = smoothPath(linePts);
  const area =
    linePts.length > 0
      ? `${line} L ${linePts[linePts.length - 1].x} ${top + plotH} L ${linePts[0].x} ${top + plotH} Z`
      : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => maxY * t);
  const barGrad = `acctDashBar-${uid}`;
  const areaGrad = `acctDashArea-${uid}`;

  return (
    <svg
      className="acct-dash-svg"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      role="img"
      aria-label="مخطط المداخيل والأعباء"
    >
      <defs>
        <linearGradient id={barGrad} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--dash-bar-a)" />
          <stop offset="100%" stopColor="var(--dash-bar-b)" />
        </linearGradient>
        <linearGradient id={areaGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--dash-line)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--dash-line)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => {
        const yy = y(t);
        return (
          <g key={`t-${t}`}>
            <line x1={left} x2={w - right} y1={yy} y2={yy} className="acct-dash-gridline" />
            <text x={left - 8} y={yy + 3} textAnchor="end" className="acct-dash-axis">
              {compact(t)}
            </text>
          </g>
        );
      })}
      {points.map((p, i) => {
        const x = left + step * i + step / 2;
        const bh = Math.max(0, (p.income / maxY) * plotH);
        const bw = Math.min(28, Math.max(10, step * 0.42));
        const active = p.income > 0 || p.spending > 0;
        return (
          <g key={p.month} opacity={active ? 1 : 0.4}>
            {bh > 0 ? (
              <rect
                x={x - bw / 2}
                y={top + plotH - bh}
                width={bw}
                height={bh}
                rx="6"
                fill={`url(#${barGrad})`}
              />
            ) : (
              <rect
                x={x - 2}
                y={top + plotH - 2}
                width={4}
                height={2}
                rx="1"
                className="acct-dash-bar-zero"
              />
            )}
            <text x={x} y={h - 12} textAnchor="middle" className="acct-dash-axis">
              {monthLabel(p.month)}
            </text>
          </g>
        );
      })}
      {area ? <path d={area} fill={`url(#${areaGrad})`} /> : null}
      {line ? <path d={line} className="acct-dash-stroke" fill="none" /> : null}
      {linePts.map((pt, i) => (
        <circle key={`d-${i}`} cx={pt.x} cy={pt.y} r="3.5" className="acct-dash-dot" />
      ))}
    </svg>
  );
}

function Donut({ pct, label, uid }: { pct: number; label: string; uid: string }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * c;
  const ringGrad = `acctDashRing-${uid}`;
  return (
    <svg viewBox="0 0 100 100" className="acct-dash-ring" role="img" aria-label={label}>
      <defs>
        <linearGradient id={ringGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--dash-ring-a)" />
          <stop offset="100%" stopColor="var(--dash-ring-b)" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r={r} className="acct-dash-ring-track" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={`url(#${ringGrad})`}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${Math.max(0.01, c - dash)}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="54" textAnchor="middle" className="acct-dash-ring-label">
        {label}
      </text>
    </svg>
  );
}

function MiniLine({ points }: { points: MonthPoint[] }) {
  const w = 240;
  const h = 96;
  const list = points.length ? points : [{ month: 'x', income: 0, spending: 0 }];
  const max = Math.max(1, ...list.flatMap((p) => [p.income, p.spending]));
  const mk = (key: 'income' | 'spending') => {
    const pts = list.map((p, i) => ({
      x: list.length === 1 ? w / 2 : (i / (list.length - 1)) * (w - 12) + 6,
      y: 10 + (1 - p[key] / max) * (h - 24),
    }));
    return smoothPath(pts);
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="acct-dash-mini" preserveAspectRatio="xMidYMid meet" role="img">
      <path d={mk('income')} className="acct-dash-stroke is-income" fill="none" />
      <path d={mk('spending')} className="acct-dash-stroke is-spend" fill="none" />
    </svg>
  );
}

function TreasuryList({
  accounts,
  onAccount,
}: {
  accounts: TreasuryAccount[];
  onAccount: (id: string) => void;
}) {
  const max = Math.max(1, ...accounts.map((a) => Math.abs(a.period_closing ?? a.balance ?? 0)));
  return (
    <ul className="acct-dash-treasury">
      {accounts.map((a) => {
        const v = a.period_closing ?? a.balance ?? 0;
        const pct = Math.round((Math.abs(v) / max) * 100);
        return (
          <li key={a.id}>
            <button type="button" onClick={() => onAccount(a.id)}>
              <span className="acct-dash-treasury-name">{a.name_ar}</span>
              <span className="acct-dash-treasury-meta">{treasuryKindLabel(a.kind)}</span>
              <span className="acct-dash-treasury-bar">
                <i style={{ width: `${pct}%` }} />
              </span>
              <strong>{money(v)}</strong>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CategoryBars({ items, max }: { items: CategoryPoint[]; max: number }) {
  return (
    <ul className="acct-dash-cats">
      {items.map((it) => {
        const pct = Math.max(4, Math.round((it.amount / max) * 100));
        return (
          <li key={it.id}>
            <span className="acct-dash-cat-label">{it.label}</span>
            <span className="acct-dash-cat-track">
              <i style={{ width: `${pct}%` }} />
            </span>
            <span className="acct-dash-cat-val">{money(it.amount)}</span>
          </li>
        );
      })}
    </ul>
  );
}

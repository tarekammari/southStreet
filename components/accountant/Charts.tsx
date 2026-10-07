'use client';

import { fmtMoney } from './money';

export type ChartItem = { id: string; label: string; value: number; color?: string };

export const CHART_COLORS = {
  income: '#34a853',
  spending: '#ea4335',
  supplier: '#fbbc04',
  client: '#1a73e8',
  assets: '#9334e6',
  neutral: '#5f6368',
};

/**
 * Horizontal bars. Arabic labels read far better beside a bar than under an axis,
 * and in RTL the bar grows from the right edge with no extra positioning.
 */
export function BarList({
  items,
  format = fmtMoney,
  emptyLabel = 'لا بيانات',
}: {
  items: ChartItem[];
  format?: (n: number) => string;
  emptyLabel?: string;
}) {
  const shown = items.filter((i) => Number.isFinite(i.value));
  const max = Math.max(1, ...shown.map((i) => Math.abs(i.value)));
  const hasValues = shown.some((i) => Math.abs(i.value) > 0);

  if (!shown.length || !hasValues) {
    return <p className="py-6 text-center text-xs opacity-50">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {shown.map((i) => (
        <li key={i.id}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-[11px] font-bold truncate">{i.label}</span>
            <span className="text-[11px] font-black tabular-nums shrink-0">{format(i.value)}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--acct-input)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(2, (Math.abs(i.value) / max) * 100)}%`,
                background: i.color || CHART_COLORS.neutral,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Month-by-month income vs spending, drawn as paired vertical bars. */
export function TrendChart({
  data,
}: {
  data: { month: string; income: number; spending: number }[];
}) {
  if (!data.length) {
    return <p className="py-8 text-center text-xs opacity-50">لا حركة في هذه الفترة</p>;
  }
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.spending]));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-[10px] font-bold">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.income }} />
          مداخيل
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.spending }} />
          مصروفات
        </span>
      </div>
      <div className="flex items-end justify-between gap-1.5 h-36 overflow-x-auto pt-2">
        {data.map((d) => (
          <div key={d.month} className="flex-1 min-w-[2.25rem] flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center gap-0.5 h-28">
              <div
                title={`مداخيل ${fmtMoney(d.income)}`}
                className="w-1/2 max-w-[0.9rem] rounded-t transition-all duration-500"
                style={{
                  height: `${Math.max(2, (d.income / max) * 100)}%`,
                  background: CHART_COLORS.income,
                }}
              />
              <div
                title={`مصروفات ${fmtMoney(d.spending)}`}
                className="w-1/2 max-w-[0.9rem] rounded-t transition-all duration-500"
                style={{
                  height: `${Math.max(2, (d.spending / max) * 100)}%`,
                  background: CHART_COLORS.spending,
                }}
              />
            </div>
            <span className="text-[9px] opacity-60 tabular-nums whitespace-nowrap">
              {d.month.slice(5)}/{d.month.slice(2, 4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Composition donut for a small number of slices. */
export function Donut({ items, centerLabel, centerValue }: {
  items: ChartItem[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const shown = items.filter((i) => i.value > 0);
  const total = shown.reduce((s, i) => s + i.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  if (!total) {
    return <p className="py-8 text-center text-xs opacity-50">لا بيانات</p>;
  }

  let offset = 0;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg viewBox="0 0 140 140" className="w-32 h-32 shrink-0" role="img" aria-label="توزيع">
        <g transform="rotate(-90 70 70)">
          {shown.map((i) => {
            const portion = i.value / total;
            const dash = portion * circumference;
            const el = (
              <circle
                key={i.id}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={i.color || CHART_COLORS.neutral}
                strokeWidth="10"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
        {centerValue && (
          <text
            x="70"
            y="68"
            textAnchor="middle"
            className="fill-current"
            style={{ fontSize: '13px', fontWeight: 600 }}
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x="70"
            y="84"
            textAnchor="middle"
            className="fill-current"
            style={{ fontSize: '9px', opacity: 0.6 }}
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="flex-1 min-w-0 space-y-1.5 w-full">
        {shown.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: i.color || CHART_COLORS.neutral }}
              />
              <span className="font-bold truncate">{i.label}</span>
            </span>
            <span className="tabular-nums font-black shrink-0">
              {Math.round((i.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

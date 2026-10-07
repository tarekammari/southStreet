'use client';

import React from 'react';
import { fmtCount, fmtMoney } from '../money';

export type Figure = {
  label: string;
  value: number | null;
  tone?: string;
  kind?: 'money' | 'count';
};

export type Result = {
  label: string;
  value: number | null;
  /** Stock totals (treasury) must not read as profit or loss. */
  kind?: 'pnl' | 'stock';
};

const show = (f: Figure) => {
  if (f.value == null) return '—';
  return f.kind === 'count' ? fmtCount(f.value) : fmtMoney(f.value);
};

/**
 * One self-contained block of the recap: headline figures always visible,
 * everything else behind a click.
 */
export default function SummaryCard({
  icon,
  title,
  subtitle,
  figures,
  result,
  open,
  onToggle,
  action,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  figures: Figure[];
  result?: Result;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const value = result?.value ?? null;
  const stock = result?.kind === 'stock';
  const positive = (value ?? 0) >= 0;

  return (
    <section className={`acct-card overflow-hidden acct-expandable acct-lift ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="acct-expandable-head"
      >
        <div className="flex items-center gap-3 mb-4">
          {icon && <span className="acct-icon-tile">{icon}</span>}
          <span className="min-w-0">
            <span className="block font-extrabold text-sm sm:text-base leading-tight">{title}</span>
          </span>
          <span className="flex-1" />
          <span className={`text-base opacity-40 acct-chevron ${open ? '-rotate-90 inline-block' : ''}`} aria-hidden>
            ‹
          </span>
        </div>

        <div
          className={`grid gap-2 ${
            (result ? figures.length + 1 : figures.length) >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
          }`}
        >
          {figures.map((f, i) => (
            <div
              key={f.label}
              className="rounded-xl px-3 py-2.5 acct-rise"
              style={{ background: 'var(--acct-input)', animationDelay: `${i * 60}ms` }}
            >
              <div className="text-[11px] font-bold opacity-60">{f.label}</div>
              <div className={`text-sm sm:text-base font-black tabular-nums ${f.tone || ''}`}>{show(f)}</div>
            </div>
          ))}

          {/* The sign and the colour carry the verdict — no need to spell it out. */}
          {result && (
            <div
              className={`rounded-xl px-3 py-2 border acct-rise acct-result ${
                stock ? 'is-stock' : positive ? 'is-positive' : 'is-negative'
              }`}
              style={{ animationDelay: `${figures.length * 60}ms` }}
            >
              <div className="text-[11px] font-bold opacity-70">{result.label}</div>
              <div
                className={`text-sm sm:text-base font-black tabular-nums ${
                  stock ? 'text-sky-700' : positive ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {value == null
                  ? '—'
                  : stock
                    ? fmtMoney(value)
                    : `${positive ? '+' : '−'}${fmtMoney(Math.abs(value))}`}
              </div>
            </div>
          )}
        </div>
      </button>

      <div className={`acct-collapse ${open ? 'acct-collapse-open' : ''}`}>
        <div className="acct-collapse-inner">
          <div className="border-t" style={{ borderColor: 'var(--acct-border)' }}>
            <div className="p-4 space-y-4">{children}</div>
            {action && <div className="px-4 pb-4 -mt-1">{action}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

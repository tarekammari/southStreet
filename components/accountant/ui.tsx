'use client';

import React, { useState } from 'react';
import { Search, Filter, ChevronDown, Sparkles } from 'lucide-react';
import { fmtMoney } from './money';

export function PanelHeader({
  eyebrow,
  title,
  subtitle,
  action,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Hide duplicate title — section name lives in the top app bar. */
  compact?: boolean;
}) {
  if (compact && !action) return null;
  if (compact) {
    return <div className="acct-panel-actions acct-rise mb-3">{action}</div>;
  }
  return (
    <div className="acct-pagehead bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm mb-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="acct-eyebrow inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 mb-2">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            {eyebrow}
          </div>
        )}
        <h3 className="acct-title text-xl font-bold text-slate-900 tracking-tight">{title}</h3>
        {subtitle && <p className="acct-subtitle text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="acct-pagehead-actions">{action}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  tone,
  sub,
  delay = 0,
  onClick,
  active,
}: {
  label: string;
  value?: number | string | null;
  tone?: string;
  sub?: string;
  delay?: number;
  /** When set, KPI acts as a toggle to show drill-down detail. */
  onClick?: () => void;
  active?: boolean;
}) {
  const shown =
    value == null
      ? '—'
      : typeof value === 'number'
        ? fmtMoney(value)
        : value;

  const className = [
    'acct-kpi acct-rise relative overflow-hidden transition-all duration-200',
    onClick ? 'acct-kpi-btn hover:-translate-y-0.5 cursor-pointer' : '',
    active ? 'acct-kpi-active ring-2 ring-emerald-500/20' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        style={{ animationDelay: `${delay}ms` }}
        onClick={onClick}
        aria-pressed={active}
      >
        <div className="acct-kpi-label text-xs font-bold text-slate-500">{label}</div>
        <div className={`acct-kpi-value text-xl font-bold text-slate-900 tabular-nums mt-1 ${tone || ''}`}>{shown}</div>
        {sub && <div className="acct-kpi-sub text-xs text-slate-400 mt-1">{sub}</div>}
      </button>
    );
  }

  return (
    <div className={className} style={{ animationDelay: `${delay}ms` }}>
      <div className="acct-kpi-label text-xs font-bold text-slate-500">{label}</div>
      <div className={`acct-kpi-value text-xl font-bold text-slate-900 tabular-nums mt-1 ${tone || ''}`}>{shown}</div>
      {sub && <div className="acct-kpi-sub text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="acct-card acct-toolbar bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">{children}</div>;
}

export function SearchField({
  value,
  onChange,
  placeholder = 'بحث بالرمز أو الاسم…',
  'aria-label': ariaLabel = 'بحث',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  'aria-label'?: string;
}) {
  return (
    <div className="acct-search-field acct-rise relative w-full">
      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="search"
        className="acct-input w-full text-sm pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50 hover:bg-white focus:bg-white transition-all outline-none"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function FilterDrawer({
  label = 'فلاتر',
  activeCount = 0,
  defaultOpen = false,
  onClear,
  period,
  children,
}: {
  label?: string;
  activeCount?: number;
  defaultOpen?: boolean;
  onClear?: () => void;
  /** Shown on the same row as the filter control (e.g. period label or date inputs). */
  period?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="acct-filter-shell mb-3">
      <div className="acct-filter-toolbar flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className={`acct-chip inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
            open
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 shadow-sm'
          }`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <Filter className="w-3.5 h-3.5 text-emerald-600" />
          <span>{open ? 'إخفاء الفلاتر' : label}</span>
          {!open && activeCount > 0 ? (
            <span className="acct-badge bg-emerald-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">
              {activeCount}
            </span>
          ) : null}
        </button>
        {onClear && activeCount > 0 ? (
          <button
            type="button"
            className="acct-btn-text text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1"
            onClick={onClear}
          >
            مسح
          </button>
        ) : null}
        {period ? (
          <div className="acct-filter-period text-xs text-slate-500 font-medium px-2" dir="ltr">
            {period}
          </div>
        ) : null}
      </div>
      <div className={`acct-filter-panel mt-2 ${open ? 'is-open' : ''}`}>
        <div className="acct-filter-panel-inner">
          <FilterBar>{children}</FilterBar>
        </div>
      </div>
    </div>
  );
}

export function Disclosure({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`acct-disclosure acct-card bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-3 transition-all ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="acct-disclosure-trigger w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/70 border-0 cursor-pointer font-bold text-slate-800 text-sm transition-colors text-right"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span
          className={`acct-chevron inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100/70 text-slate-500 transition-transform duration-200 ${
            open ? 'rotate-180 bg-emerald-50 text-emerald-700' : ''
          }`}
          aria-hidden
        >
          <ChevronDown className="w-4 h-4" />
        </span>
      </button>
      <div className={`acct-collapse ${open ? 'acct-collapse-open' : ''}`}>
        <div className="acct-collapse-inner border-t border-slate-100">
          <div className="acct-disclosure-body p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="acct-empty">{children}</div>;
}

export type SlideListAccent = 'none' | 'due' | 'settled' | 'overdue' | 'due-soon';

function SlideListChevron({ open }: { open: boolean }) {
  return (
    <span className={`text-base opacity-40 acct-chevron shrink-0 ${open ? '-rotate-90 inline-block' : ''}`} aria-hidden>
      ‹
    </span>
  );
}

/** Unified expandable list shell (same pattern as المداخيل / ReceiptsPanel). */
export function SlideList({
  children,
  className = '',
  nested = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Inside recap cards — no outer card chrome. */
  nested?: boolean;
}) {
  const list = (
    <ul className="divide-y" style={{ borderColor: 'var(--acct-border)' }}>
      {children}
    </ul>
  );
  if (nested) {
    return (
      <div
        className={`overflow-hidden acct-rise rounded-xl ${className}`.trim()}
        style={{ background: 'var(--acct-input)' }}
      >
        {list}
      </div>
    );
  }
  return <div className={`acct-card overflow-hidden acct-rise ${className}`.trim()}>{list}</div>;
}

export function SlideListEmpty({ children }: { children: React.ReactNode }) {
  return <li className="acct-empty">{children}</li>;
}

export function SlideListFooter({ children }: { children: React.ReactNode }) {
  return (
    <li className="px-3 py-2.5 flex items-center gap-3 font-black" style={{ background: 'var(--acct-input)' }}>
      {children}
    </li>
  );
}

export function SlideListItem({
  open,
  onToggle,
  index = 0,
  accent = 'none',
  trailing,
  expandable = true,
  row,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  index?: number;
  accent?: SlideListAccent;
  trailing?: React.ReactNode;
  /** When false, row toggles without a slide-down body (e.g. supplier drawer). */
  expandable?: boolean;
  row: React.ReactNode;
  children?: React.ReactNode;
}) {
  const accentClass =
    accent === 'due'
      ? 'is-due'
      : accent === 'settled'
        ? 'is-settled'
        : accent === 'overdue'
          ? 'is-overdue'
          : accent === 'due-soon'
            ? 'is-due-soon'
            : '';

  const trigger = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`flex-1 min-w-0 text-right px-3 py-2.5 flex items-center gap-3 cursor-pointer acct-row ${
        trailing ? '' : 'w-full'
      }`}
    >
      <SlideListChevron open={open} />
      {row}
    </button>
  );

  return (
    <li
      className={`acct-client ${accentClass} ${open ? 'is-open' : ''}`.trim()}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {trailing ? (
        <div className="flex items-center">
          {trigger}
          {trailing}
        </div>
      ) : (
        trigger
      )}
      {expandable && children != null ? (
        <div className={`acct-collapse ${open ? 'acct-collapse-open' : ''}`}>
          <div className="acct-collapse-inner">{children}</div>
        </div>
      ) : null}
    </li>
  );
}

export function PrimaryButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-700/20 hover:shadow-lg hover:shadow-emerald-700/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:pointer-events-none acct-btn acct-btn-primary ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:pointer-events-none acct-btn acct-btn-ghost ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`acct-iconbtn ${className}`} {...props}>
      {children}
    </button>
  );
}

export function PayButton({
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`acct-pay ${className}`} {...props}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <path fill="currentColor" d="M8 3.2a.8.8 0 0 1 .8.8v3.2H12a.8.8 0 0 1 0 1.6H8.8V12a.8.8 0 0 1-1.6 0V8.8H4a.8.8 0 0 1 0-1.6h3.2V4A.8.8 0 0 1 8 3.2Z" />
      </svg>
    </button>
  );
}

export function Segmented({
  children,
  label,
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="acct-segmented" role="tablist" aria-label={label}>
      {children}
    </div>
  );
}

export function Alert({
  children,
  tone = 'warn',
}: {
  children: React.ReactNode;
  tone?: 'warn' | 'error' | 'info';
}) {
  return <div className={`acct-alert is-${tone}`}>{children}</div>;
}

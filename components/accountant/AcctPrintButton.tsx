'use client';

import { Printer } from 'lucide-react';

export default function AcctPrintButton({
  onClick,
  disabled,
  label = 'معاينة / طباعة',
  compact,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        compact
          ? 'group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-sm text-xs font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:pointer-events-none acct-no-print'
          : 'group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-slate-900/15 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:pointer-events-none acct-no-print'
      }
      onClick={onClick}
      disabled={disabled}
    >
      <Printer
        className={compact ? 'w-3.5 h-3.5 shrink-0 text-slate-500' : 'w-4 h-4 shrink-0 text-white/85'}
        aria-hidden
      />
      <span>{label}</span>
    </button>
  );
}

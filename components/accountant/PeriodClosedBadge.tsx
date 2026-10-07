'use client';

import { useEffect, useState } from 'react';

type Props = { date: string; className?: string };

/** Warning only — Phase 1 does not block saves on closed periods. */
export default function PeriodClosedBadge({ date, className = '' }: Props) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const d = String(date || '').slice(0, 10);
    if (!d || d.length < 7) {
      setClosed(false);
      return;
    }
    const year = d.slice(0, 4);
    const month = d.slice(5, 7);
    fetch(`/api/finance/periods?year=${year}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const m = Number(month);
        const row = (data.items || []).find((p: { month: number; status: string }) => p.month === m);
        setClosed(row?.status === 'closed');
      })
      .catch(() => setClosed(false));
  }, [date]);

  if (!closed) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 ${className}`}
      title="الفترة المحاسبية مقفلة — التسجيل ما زال مسموحاً (تحذير فقط)"
    >
      فترة مقفلة
    </span>
  );
}

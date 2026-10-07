'use client';

import { useEffect, useMemo, useState } from 'react';

export type ScfChartAccount = {
  code: string;
  label_ar: string;
  class: number;
};

type Props = {
  value: string;
  onChange: (code: string, account?: ScfChartAccount) => void;
  label?: string;
  hint?: string;
  className?: string;
  required?: boolean;
  /** SCF class. Investment suppliers use 2; operating charges use 6. */
  accountClass?: number;
};

/** Pick expense account (SCF class 6) from the chart — same source as دليل الحسابات / الميزانية. */
export default function ScfClass6AccountSelect({
  value,
  onChange,
  label,
  hint,
  className = 'acct-input w-full mt-1',
  required,
  accountClass = 6,
}: Props) {
  const fieldLabel =
    label || (accountClass === 2 ? 'حساب التثبيت (SCF — الفئة 2)' : 'حساب المصروف (SCF — الفئة 6)');
  const [accounts, setAccounts] = useState<ScfChartAccount[]>([]);
  const [loadErr, setLoadErr] = useState('');

  useEffect(() => {
    fetch(`/api/finance/chart?class=${accountClass}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const rows = (d.accounts || []) as ScfChartAccount[];
        setAccounts(
          rows.sort(
            (a, b) =>
              (Number(a.code) || 0) - (Number(b.code) || 0) || a.code.localeCompare(b.code)
          )
        );
        setLoadErr('');
      })
      .catch(() => {
        setAccounts([]);
        setLoadErr('تعذر تحميل دليل الحسابات');
      });
  }, [accountClass]);

  const selected = useMemo(
    () => accounts.find((a) => a.code === value) || null,
    [accounts, value]
  );

  return (
    <label className="block text-xs font-bold">
      {fieldLabel}
      {required ? ' *' : ''}
      <select
        required={required}
        className={className}
        value={value || ''}
        onChange={(e) => {
          const code = e.target.value;
          onChange(code, accounts.find((a) => a.code === code));
        }}
      >
        <option value="">— اختر حساباً —</option>
        {accounts.map((a) => (
          <option key={a.code} value={a.code}>
            {a.code} — {a.label_ar}
          </option>
        ))}
      </select>
      {loadErr ? <span className="block text-[10px] text-rose-600 mt-0.5">{loadErr}</span> : null}
      {hint ? <span className="block text-[10px] font-normal opacity-60 mt-0.5">{hint}</span> : null}
      {selected && !hint ? (
        <span className="block text-[10px] font-normal opacity-60 mt-0.5">
          {accountClass === 2 ? 'يُثبت الأصل في الميزانية تحت' : 'يظهر في حساب النتيجة تحت'} {selected.code}
        </span>
      ) : null}
    </label>
  );
}

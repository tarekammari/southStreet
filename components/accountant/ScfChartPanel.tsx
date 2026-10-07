'use client';

import { useEffect, useMemo, useState } from 'react';
import { SCF_CLASS_LABELS_AR } from '@/lib/accountant-scf';
import { Disclosure, PanelHeader, SearchField } from './ui';

type Account = {
  code: string;
  label_ar: string;
  label_fr: string;
  class: number;
  parent_code: string | null;
};

type Mapping = { category_id: string; category_label: string; scf_code: string; note_ar: string };

export default function ScfChartPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [supplierMap, setSupplierMap] = useState<Mapping[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Mapping[]>([]);
  const [classFilter, setClassFilter] = useState<number | 'all'>('all');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [class2, setClass2] = useState<Account[]>([]);

  useEffect(() => {
    fetch('/api/finance/chart?class=2')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setClass2(d.accounts || []))
      .catch(() => setClass2([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (classFilter !== 'all') params.set('class', String(classFilter));
    if (q.trim()) params.set('q', q.trim());
    fetch(`/api/finance/chart?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setAccounts(d.accounts || []);
        setSupplierMap(d.supplier_mappings || []);
        setLedgerMap(d.ledger_mappings || []);
        setErr('');
      })
      .catch(() => {
        setErr('تعذر تحميل دليل الحسابات');
        setAccounts([]);
      });
  }, [classFilter, q]);

  const classes = useMemo(() => [1, 2, 3, 4, 5, 6, 7], []);

  return (
    <div className="space-y-4">
      <PanelHeader compact title="دليل الحسابات SCF" subtitle="مدونة الحسابات — الجريدة الرسمية 2009" />
      <p className="text-xs acct-top-subtitle px-1">
        الإطار ذو الرقمين إجباري (ص 44). الربط بالفئات التشغيلية للعرض فقط — لا قيد مزدوج في المرحلة 1.
      </p>

      <FilterRow q={q} setQ={setQ} classFilter={classFilter} setClassFilter={setClassFilter} classes={classes} />

      {err && <p className="text-xs font-bold text-rose-600">{err}</p>}

      <Disclosure title="حسابات الاستثمارات — الفئة 2" defaultOpen>
        <p className="text-xs opacity-70 mb-2 px-1">تثبيتات معنوية وعينية ومالية، واهتلاكاتها وخسائر القيمة.</p>
        <div className="overflow-x-auto">
          <table className="acct-kpi-detail-table w-full">
            <thead>
              <tr>
                <th>الرمز</th>
                <th>الاسم</th>
                <th>أب</th>
              </tr>
            </thead>
            <tbody>
              {class2.map((a) => (
                  <tr key={`c2-${a.code}`}>
                    <td className="font-mono font-bold">{a.code}</td>
                    <td>{a.label_ar}</td>
                    <td className="font-mono text-xs opacity-70">{a.parent_code || '—'}</td>
                  </tr>
                ))}
              {class2.length === 0 && (
                <tr>
                  <td colSpan={3} className="opacity-60 text-center py-4">
                    لا حسابات في الفئة 2
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Disclosure>

      <Disclosure title="حسابات SCF" defaultOpen>
        <div className="overflow-x-auto">
          <table className="acct-kpi-detail-table w-full">
            <thead>
              <tr>
                <th>الرمز</th>
                <th>الاسم</th>
                <th>الفئة</th>
                <th>أب</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.code}>
                  <td className="font-mono font-bold">{a.code}</td>
                  <td>{a.label_ar}</td>
                  <td className="text-xs">{SCF_CLASS_LABELS_AR[String(a.class)] || a.class}</td>
                  <td className="font-mono text-xs opacity-70">{a.parent_code || '—'}</td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={4} className="opacity-60 text-center py-4">
                    لا نتائج
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Disclosure>

      <Disclosure title="ربط فئات الموردين" defaultOpen={false}>
        <MappingTable rows={supplierMap} />
      </Disclosure>

      <Disclosure title="ربط فئات اليومية" defaultOpen={false}>
        <MappingTable rows={ledgerMap} />
      </Disclosure>
    </div>
  );
}

function FilterRow({
  q,
  setQ,
  classFilter,
  setClassFilter,
  classes,
}: {
  q: string;
  setQ: (v: string) => void;
  classFilter: number | 'all';
  setClassFilter: (v: number | 'all') => void;
  classes: number[];
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
      <SearchField value={q} onChange={setQ} placeholder="بحث برمز أو اسم…" />
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={`acct-chip ${classFilter === 'all' ? 'acct-chip-active' : ''}`}
          onClick={() => setClassFilter('all')}
        >
          الكل
        </button>
        {classes.map((c) => (
          <button
            key={c}
            type="button"
            className={`acct-chip ${classFilter === c ? 'acct-chip-active' : ''}`}
            onClick={() => setClassFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function MappingTable({ rows }: { rows: Mapping[] }) {
  return (
    <table className="acct-kpi-detail-table w-full">
      <thead>
        <tr>
          <th>الفئة</th>
          <th>حساب SCF</th>
          <th>ملاحظة</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.category_id}>
            <td>{r.category_label}</td>
            <td className="font-mono font-bold">{r.scf_code}</td>
            <td className="text-xs opacity-80">{r.note_ar}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

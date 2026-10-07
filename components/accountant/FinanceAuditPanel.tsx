'use client';

import { useEffect, useState } from 'react';
import { Disclosure, FilterDrawer, PanelHeader } from './ui';

type Row = {
  id: string;
  user_name: string | null;
  role: string | null;
  action: string;
  entity: string;
  entity_id: string;
  before_json?: string | null;
  after_json?: string | null;
  created_at: string;
};

const ENTITIES: { id: string; label: string }[] = [
  { id: 'income_client', label: 'عملاء المداخيل' },
  { id: 'receipt', label: 'سندات القبض' },
  { id: 'client_payment', label: 'دفعات العملاء' },
  { id: 'ledger', label: 'اليومية' },
  { id: 'supplier', label: 'الموردون' },
  { id: 'supplier_invoice', label: 'فواتير المورد' },
  { id: 'supplier_payment', label: 'دفعات المورد' },
  { id: 'salary', label: 'الرواتب' },
  { id: 'service', label: 'الخدمات' },
  { id: 'treasury', label: 'الخزينة' },
  { id: 'asset', label: 'الأصول' },
  { id: 'fiscal_period', label: 'الفترات' },
];

function actionLabel(action: string) {
  switch (String(action || '').toLowerCase()) {
    case 'create':
      return 'إنشاء';
    case 'update':
      return 'تعديل / إخفاء';
    case 'delete':
      return 'حذف نهائي';
    case 'void':
      return 'إلغاء (أرشيف)';
    case 'close_period':
      return 'إقفال فترة';
    case 'reopen_period':
      return 'إعادة فتح فترة';
    default:
      return action || '—';
  }
}

function entityLabel(entity: string) {
  return ENTITIES.find((e) => e.id === entity)?.label || entity || '—';
}

function summaryOf(row: Row) {
  try {
    const after = row.after_json ? JSON.parse(row.after_json) : null;
    if (after?.summary_ar) return String(after.summary_ar);
    if (after?.hidden === true) return 'إخفاء من الدليل الظاهر';
    if (after?.hidden === false) return 'إعادة إظهار في الدليل';
    if (after?.purged) return 'حذف نهائي من الدليل';
    if (after?.deleted) return 'أُلغي وبقي في الأرشيف';
  } catch {
    /* ignore */
  }
  return '';
}

export default function FinanceAuditPanel() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [entity, setEntity] = useState('');
  const [user, setUser] = useState('');
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (entity) q.set('entity', entity);
    if (user.trim()) q.set('user', user.trim());
    q.set('limit', '120');
    fetch(`/api/finance/audit-log?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setItems(d.items || []);
        setTotal(d.total || 0);
        setErr('');
      })
      .catch(() => {
        setErr('تعذر تحميل السجل');
        setItems([]);
      });
  }, [from, to, entity, user]);

  return (
    <div className="space-y-4">
      <PanelHeader compact title="سجل التدقيق" subtitle="عمليات المالية — للقراءة فقط" />
      <p className="text-xs acct-top-subtitle px-1">
        يشمل إخفاء العملاء، إلغاء الدفعات/السندات، والحذف النهائي. السجلات الملغاة تبقى ظاهرة هنا وللأرشيف.
      </p>

      <FilterDrawer label="تصفية" activeCount={[from, to, entity, user].filter(Boolean).length}>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            من
            <input type="date" className="acct-input block mt-1 w-full" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm">
            إلى
            <input type="date" className="acct-input block mt-1 w-full" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="text-sm sm:col-span-2">
            مستخدم
            <input className="acct-input block mt-1 w-full" value={user} onChange={(e) => setUser(e.target.value)} placeholder="اسم أو معرّف" />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <button type="button" className={`acct-chip ${!entity ? 'acct-chip-active' : ''}`} onClick={() => setEntity('')}>
            كل الكيانات
          </button>
          {ENTITIES.map((e) => (
            <button
              key={e.id}
              type="button"
              className={`acct-chip ${entity === e.id ? 'acct-chip-active' : ''}`}
              onClick={() => setEntity(e.id)}
            >
              {e.label}
            </button>
          ))}
        </div>
      </FilterDrawer>

      {err && <p className="text-xs font-bold text-rose-600">{err}</p>}

      <Disclosure title={`الأحداث (${total})`} defaultOpen>
        <ul className="space-y-2 text-sm">
          {items.map((r) => {
            const summary = summaryOf(r);
            return (
              <li key={r.id} className="py-2 border-b" style={{ borderColor: 'var(--acct-border)' }}>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-bold">
                    {actionLabel(r.action)} · {entityLabel(r.entity)}
                  </span>
                  <span className="text-xs opacity-60 tabular-nums">{r.created_at?.slice(0, 19).replace('T', ' ')}</span>
                </div>
                {summary ? <div className="text-xs mt-1 font-bold text-slate-700">{summary}</div> : null}
                <div className="text-xs mt-1 opacity-80">
                  {r.user_name || '—'} ({r.role || '—'}) · {r.entity_id}
                </div>
              </li>
            );
          })}
          {items.length === 0 && <li className="py-8 text-center opacity-60">لا أحداث</li>}
        </ul>
      </Disclosure>
    </div>
  );
}

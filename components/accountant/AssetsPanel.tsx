'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fmtMoney, PAY_METHODS } from './money';
import {
  ASSET_CATEGORIES,
  DEFAULT_ASSET_CATEGORY,
  assetCategoryLabel,
  assetCategoryLife,
  normalizeAssetCategory,
  type AssetCategoryId,
} from '@/lib/finance-categories';
import {
  Alert,
  Disclosure,
  FilterDrawer,
  Kpi,
  PanelHeader,
  PrimaryButton,
  SlideList,
  SlideListEmpty,
  SlideListItem,
} from './ui';

type Asset = {
  id: string;
  name_ar: string;
  category: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  purchase_date: string;
  supplier: string;
  useful_life_years: number;
  status: string;
  note: string;
  age_years: number;
  accumulated_depreciation: number;
  net_book_value: number;
};

type Summary = {
  total_cost: number;
  net_book_value: number;
  accumulated_depreciation: number;
  period_depreciation?: number;
  count: number;
  active_count: number;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  name_ar: '',
  category: DEFAULT_ASSET_CATEGORY as string,
  quantity: 1,
  unit_cost: 0,
  purchase_date: todayISO(),
  supplier: '',
  useful_life_years: assetCategoryLife(DEFAULT_ASSET_CATEGORY),
  status: 'ACTIVE',
  note: '',
  post_to_ledger: false,
  method: 'CASH',
});

function statusChip(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'SOLD') return { text: 'مُباع', cls: 'bg-sky-500/15 text-sky-700' };
  if (s === 'RETIRED') return { text: 'مُستبعد', cls: 'bg-slate-500/15 opacity-80' };
  return { text: 'بالخدمة', cls: 'bg-emerald-500/15 text-emerald-700' };
}

export default function AssetsPanel() {
  const searchParams = useSearchParams();
  const recapFrom = searchParams.get('from')?.slice(0, 10) || '';
  const recapTo = searchParams.get('to')?.slice(0, 10) || '';

  const [items, setItems] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [catFilter, setCatFilter] = useState('all');
  const [openId, setOpenId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (recapFrom && recapTo) {
      q.set('from', recapFrom);
      q.set('to', recapTo);
    }
    const suffix = q.toString() ? `?${q.toString()}` : '';
    fetch(`/api/finance/assets${suffix}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('تعذر تحميل الأصول'))))
      .then((d) => {
        setItems(d.items || []);
        setSummary(d.summary || null);
      })
      .catch((e) => setErr(e.message || 'خطأ'));
  }, [recapFrom, recapTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && formOpen) setFormOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [formOpen]);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const a of items) {
      const id = normalizeAssetCategory(a.category);
      counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [items]);

  const rows = useMemo(
    () =>
      items.filter((a) => catFilter === 'all' || normalizeAssetCategory(a.category) === catFilter),
    [items, catFilter]
  );

  const submit = async (url: string, init: RequestInit, onOk: () => void) => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'تعذّر تنفيذ العملية');
        return;
      }
      onOk();
      load();
    } catch {
      setErr('تعذّر الاتصال بالخادم');
    } finally {
      setBusy(false);
    }
  };

  const openNew = () => {
    setEditingId('');
    setForm(emptyForm());
    setErr('');
    setFormOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setForm({
      name_ar: asset.name_ar,
      category: normalizeAssetCategory(asset.category),
      quantity: asset.quantity,
      unit_cost: asset.unit_cost,
      purchase_date: asset.purchase_date || todayISO(),
      supplier: asset.supplier || '',
      useful_life_years: asset.useful_life_years,
      status: asset.status,
      note: asset.note || '',
      post_to_ledger: false,
      method: 'CASH',
    });
    setErr('');
    setFormOpen(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      void submit(
        '/api/finance/assets',
        { method: 'PATCH', body: JSON.stringify({ id: editingId, ...form }) },
        () => setFormOpen(false)
      );
      return;
    }
    void submit('/api/finance/assets', { method: 'POST', body: JSON.stringify(form) }, () =>
      setFormOpen(false)
    );
  };

  const remove = (id: string) => {
    void submit(`/api/finance/assets?id=${encodeURIComponent(id)}`, { method: 'DELETE' }, () =>
      setOpenId('')
    );
  };

  return (
    <div className="space-y-4">
      <PanelHeader compact title="الأصول" action={<PrimaryButton onClick={openNew}>أصل جديد</PrimaryButton>} />

      {recapFrom && recapTo ? (
        <p className="text-xs font-bold acct-top-subtitle px-1">
          «إهلاك الفترة» = بند الأصول في حساب النتيجة ({recapFrom} → {recapTo})
        </p>
      ) : null}

      <Disclosure title="ملخص الأصول" defaultOpen={false}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Kpi label="التكلفة" value={summary?.total_cost} tone="text-sky-700" />
          <Kpi label="الدفترية" value={summary?.net_book_value} tone="text-emerald-700" delay={60} />
          <Kpi
            label={recapFrom && recapTo ? 'إهلاك الفترة' : 'الإهلاك المتراكم'}
            value={
              recapFrom && recapTo ? summary?.period_depreciation : summary?.accumulated_depreciation
            }
            tone="text-amber-700"
            delay={120}
          />
          <Kpi
            label="بالخدمة"
            value={summary ? `${summary.active_count} / ${summary.count}` : '—'}
            delay={180}
          />
        </div>
      </Disclosure>

      {err && <Alert tone="error">{err}</Alert>}

      <FilterDrawer activeCount={catFilter !== 'all' ? 1 : 0} onClear={catFilter !== 'all' ? () => setCatFilter('all') : undefined}>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`acct-chip ${catFilter === 'all' ? 'acct-chip-active' : ''}`}
            onClick={() => setCatFilter('all')}
          >
            الكل
            <span className="opacity-80 tabular-nums">{catCounts.all || 0}</span>
          </button>
          {ASSET_CATEGORIES.filter((c) => (catCounts[c.id] || 0) > 0).map((c) => (
            <button
              key={c.id}
              type="button"
              className={`acct-chip ${catFilter === c.id ? 'acct-chip-active' : ''}`}
              onClick={() => setCatFilter(c.id)}
            >
              {c.label}
              <span className="opacity-80 tabular-nums">{catCounts[c.id] || 0}</span>
            </button>
          ))}
        </div>
      </FilterDrawer>

      <SlideList>
        {rows.map((a, i) => {
          const open = openId === a.id;
          const st = statusChip(a.status);
          return (
            <SlideListItem
              key={a.id}
              index={i}
              open={open}
              onToggle={() => setOpenId(open ? '' : a.id)}
              row={
                <>
                  <span className="min-w-0 flex-1">
                    <span className="font-extrabold text-sm truncate block">{a.name_ar}</span>
                    <span className="text-[10px] font-bold opacity-60 mt-0.5">
                      {assetCategoryLabel(a.category)}
                      {a.quantity > 1 ? ` · ${a.quantity} وحدة` : ''}
                    </span>
                  </span>
                  <span className="text-sm font-black tabular-nums shrink-0 text-sky-700">{fmtMoney(a.total_cost)}</span>
                </>
              }
            >
              <div className="px-3 pb-3 space-y-3" style={{ background: 'var(--acct-input)' }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3">
                  <Cell label="الحالة">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.text}</span>
                  </Cell>
                  <Cell label="سعر الوحدة">{fmtMoney(a.unit_cost)}</Cell>
                  <Cell label="الكمية">{a.quantity}</Cell>
                  <Cell label="تاريخ الشراء">{a.purchase_date || '—'}</Cell>
                  <Cell label="العمر">{a.age_years} سنة</Cell>
                  <Cell label="العمر الإنتاجي">{a.useful_life_years} سنة</Cell>
                  <Cell label="الاستهلاك المتراكم">{fmtMoney(a.accumulated_depreciation)}</Cell>
                  <Cell label="القيمة الدفترية">{fmtMoney(a.net_book_value)}</Cell>
                  <Cell label="المورد">{a.supplier || '—'}</Cell>
                </div>
                {a.note && <p className="text-[11px] opacity-70">{a.note}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                    onClick={() => openEdit(a)}
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-bold cursor-pointer disabled:opacity-40"
                    onClick={() => remove(a.id)}
                  >
                    حذف
                  </button>
                </div>
              </div>
            </SlideListItem>
          );
        })}
        {rows.length === 0 ? <SlideListEmpty>لا أصول في هذا التصنيف</SlideListEmpty> : null}
      </SlideList>

      {formOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setFormOpen(false)}
        >
          <form
            className="acct-card rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onSubmit={save}
          >
            <h4 className="font-bold">{editingId ? 'تعديل أصل' : 'أصل جديد'}</h4>
            {err && <p className="text-xs font-bold text-rose-600">{err}</p>}

            <label className="block text-xs font-bold">
              الاسم
              <input
                required
                autoFocus
                className="acct-input w-full mt-1"
                placeholder="مثال: حافلة نقل المعتمرين"
                value={form.name_ar}
                onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold">
                التصنيف
                <select
                  className="acct-input w-full mt-1"
                  value={form.category}
                  onChange={(e) => {
                    const category = normalizeAssetCategory(e.target.value) as AssetCategoryId;
                    setForm((f) => ({
                      ...f,
                      category,
                      useful_life_years: assetCategoryLife(category),
                    }));
                  }}
                >
                  {ASSET_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold">
                الحالة
                <select
                  className="acct-input w-full mt-1"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="ACTIVE">بالخدمة</option>
                  <option value="SOLD">مُباع</option>
                  <option value="RETIRED">مُستبعد</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold">
                سعر الوحدة
                <input
                  type="number"
                  required
                  min={1}
                  className="acct-input w-full mt-1"
                  value={form.unit_cost}
                  onChange={(e) => setForm((f) => ({ ...f, unit_cost: Number(e.target.value) }))}
                />
              </label>
              <label className="block text-xs font-bold">
                الكمية
                <input
                  type="number"
                  min={1}
                  className="acct-input w-full mt-1"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                />
              </label>
            </div>

            <p className="text-[11px] font-bold opacity-70">
              الإجمالي: {fmtMoney((Number(form.unit_cost) || 0) * (Number(form.quantity) || 1))}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold">
                تاريخ الشراء
                <input
                  type="date"
                  className="acct-input w-full mt-1"
                  value={form.purchase_date}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold">
                العمر الإنتاجي (سنة)
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="acct-input w-full mt-1"
                  value={form.useful_life_years}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, useful_life_years: Number(e.target.value) }))
                  }
                />
              </label>
            </div>

            <label className="block text-xs font-bold">
              المورد / الجهة
              <input
                className="acct-input w-full mt-1"
                placeholder="اختياري"
                value={form.supplier}
                onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
              />
            </label>

            <label className="block text-xs font-bold">
              ملاحظة
              <input
                className="acct-input w-full mt-1"
                placeholder="اختياري"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </label>

            {!editingId && (
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.post_to_ledger}
                    onChange={(e) => setForm((f) => ({ ...f, post_to_ledger: e.target.checked }))}
                  />
                  ترحيل الشراء إلى دفتر الحركة
                </label>
                {form.post_to_ledger && (
                  <select
                    className="acct-input w-full acct-slide-down"
                    value={form.method}
                    onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
                  >
                    {PAY_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="flex-1 py-2 rounded-xl acct-muted font-bold cursor-pointer"
                onClick={() => setFormOpen(false)}
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                حفظ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold opacity-55">{label}</div>
      <div className="text-xs font-bold tabular-nums mt-0.5">{children}</div>
    </div>
  );
}

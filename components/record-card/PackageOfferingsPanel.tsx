'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { DEFAULT_ROOM_PRICES, defaultAnnexes, roomLabel, type PackageAnnex } from '@/lib/package-options';
import { jsonAuthHeaders } from '@/lib/api-client';

type RoomPrice = { room_type: string; amount: number; price_id?: string };

function money(n: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
}

export default function PackageOfferingsPanel({
  packageId,
}: {
  packageId?: string | null;
}) {
  const [rooms, setRooms] = useState<RoomPrice[]>(DEFAULT_ROOM_PRICES.map((row) => ({ ...row })));
  const [annexes, setAnnexes] = useState<PackageAnnex[]>(defaultAnnexes());
  const [loading, setLoading] = useState(Boolean(packageId));
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const load = useCallback(async () => {
    if (!packageId) {
      setRooms(DEFAULT_ROOM_PRICES.map((row) => ({ ...row })));
      setAnnexes(defaultAnnexes());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/packages', { headers: jsonAuthHeaders(), cache: 'no-store' });
      const rows = await res.json();
      const pkg = Array.isArray(rows) ? rows.find((row: { package_id?: string }) => row.package_id === packageId) : null;
      if (pkg) {
        const prices = Array.isArray(pkg.prices) ? pkg.prices : [];
        const nextRooms = DEFAULT_ROOM_PRICES.map((seed) => {
          const hit = prices.find((row: { room_type?: string }) => String(row.room_type || '').toUpperCase() === seed.room_type);
          return {
            room_type: seed.room_type,
            amount: hit ? Number(hit.amount) || seed.amount : seed.amount,
            price_id: hit?.price_id,
          };
        });
        setRooms(nextRooms);
        setAnnexes(Array.isArray(pkg.annex_options) && pkg.annex_options.length ? pkg.annex_options : defaultAnnexes());
      }
    } catch {
      setError('تعذر تحميل خيارات البرنامج');
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!packageId) return;
    setSaving(true);
    setError('');
    setNote('');
    try {
      const res = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          options_only: true,
          package_id: packageId,
          prices: rooms.map((room) => ({
            room_type: room.room_type,
            amount: Number(room.amount) || 0,
            price_id: room.price_id,
          })),
          annex_options: annexes,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'تعذر حفظ الخيارات');
      } else {
        setNote('تم حفظ أسعار الغرف وخيارات الحجز بنجاح ✓');
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = annexes.filter((item) => item.enabled).length;

  const addNewAnnex = () => {
    const title = newTitle.trim();
    if (!title) return;
    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const newAnnex: PackageAnnex = {
      id,
      title,
      detail: newDetail.trim(),
      price: Math.max(0, Number(newPrice) || 0),
      enabled: true,
    };
    setAnnexes((prev) => [...prev, newAnnex]);
    setNewTitle('');
    setNewDetail('');
    setNewPrice('');
    setAddingNew(false);
    setNote('');
  };

  const removeAnnex = (id: string) => {
    setAnnexes((prev) => prev.filter((item) => item.id !== id));
    setNote('');
  };

  return (
    <section className="pkg-offer">
      <header className="pkg-offer-head">
        <div>
          <h3>خيارات وأسعار الحجز</h3>
          <p>
            {packageId
              ? `${enabledCount} خيار مفعّل · ${rooms.length} أنواع غرف`
              : 'تُحفظ هذه الأسعار والخيارات الافتراضية مع البرنامج. يمكن تعديلها بعد الإضافة.'}
          </p>
        </div>
        {packageId ? (
          <button type="button" className="pkg-offer-save" onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ التعديلات
          </button>
        ) : null}
      </header>

      {error ? <p className="pkg-offer-error">{error}</p> : null}
      {note ? <p className="pkg-offer-note">{note}</p> : null}

      {loading ? (
        <p className="pkg-offer-muted">جاري تحميل الخيارات…</p>
      ) : (
        <>
          {/* ─── Room Prices ─── */}
          <div className="pkg-offer-block">
            <h4>أسعار الغرف حسب نوع الإقامة</h4>
            <div className="pkg-offer-rooms">
              {rooms.map((room) => (
                <label key={room.room_type} className="pkg-offer-room">
                  <span>{roomLabel(room.room_type)}</span>
                  <span className="pkg-offer-amount" dir="ltr">
                    <input
                      inputMode="decimal"
                      value={room.amount ? String(room.amount) : ''}
                      onChange={(e) => {
                        const amount = Math.max(0, Number(String(e.target.value).replace(/[^\d.]/g, '')) || 0);
                        setRooms((prev) => prev.map((row) => (row.room_type === room.room_type ? { ...row, amount } : row)));
                        setNote('');
                      }}
                      disabled={!packageId}
                    />
                    <em>DZD</em>
                  </span>
                  <small dir="ltr">{money(room.amount)} DZD</small>
                </label>
              ))}
            </div>
          </div>

          {/* ─── Additional Booking Options & Extras ─── */}
          <div className="pkg-offer-block">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="m-0 font-bold text-slate-700 text-xs">خيارات وخدمات الحجز الإضافية (تفعيل أو إلغاء)</h4>
              {packageId && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
                  onClick={() => setAddingNew(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة خيار جديد
                </button>
              )}
            </div>

            {/* Add new annex inline form */}
            {addingNew && (
              <div className="p-3 mb-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="اسم الخيار (مثال: حقيبة سفر إضافية)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="sm:col-span-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="السعر بالدينار"
                      inputMode="decimal"
                      dir="ltr"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value.replace(/[^\d.]/g, ''))}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white pl-10 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute left-2.5 text-[11px] font-bold text-slate-400">DZD</span>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="وصف مختصر للخدمة الإضافية (اختياري)"
                  value={newDetail}
                  onChange={(e) => setNewDetail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    className="px-3 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 inline-flex items-center gap-1 transition-colors cursor-pointer"
                    onClick={addNewAnnex}
                    disabled={!newTitle.trim()}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    تأكيد الإضافة
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                    onClick={() => {
                      setAddingNew(false);
                      setNewTitle('');
                      setNewDetail('');
                      setNewPrice('');
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            <div className="pkg-offer-annexes">
              {annexes.map((item) => {
                const isCustom = item.id.startsWith('custom_');
                return (
                  <article key={item.id} className={`pkg-offer-annex ${item.enabled ? 'is-on' : ''}`}>
                    <div className="pkg-offer-annex-top flex items-center justify-between gap-1">
                      <button
                        type="button"
                        className="pkg-offer-toggle"
                        aria-pressed={item.enabled}
                        disabled={!packageId}
                        onClick={() => {
                          setAnnexes((prev) => prev.map((row) => (row.id === item.id ? { ...row, enabled: !row.enabled } : row)));
                          setNote('');
                        }}
                      >
                        <span className="pkg-offer-switch" />
                        <strong>{item.title}</strong>
                      </button>
                      {isCustom && packageId && (
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700 p-1 rounded-md transition-colors"
                          title="حذف هذا الخيار"
                          onClick={() => removeAnnex(item.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {item.detail ? <p>{item.detail}</p> : null}
                    <label className="pkg-offer-amount" dir="ltr">
                      <input
                        inputMode="decimal"
                        value={item.price ? String(item.price) : ''}
                        disabled={!packageId}
                        onChange={(e) => {
                          const price = Math.max(0, Number(String(e.target.value).replace(/[^\d.]/g, '')) || 0);
                          setAnnexes((prev) => prev.map((row) => (row.id === item.id ? { ...row, price } : row)));
                          setNote('');
                        }}
                      />
                      <em>DZD</em>
                    </label>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

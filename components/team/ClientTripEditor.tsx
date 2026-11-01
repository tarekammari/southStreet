'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { adminFetch, keyErrorMessage } from '@/lib/webauthn-client';
import { ROOM_LABELS } from '@/lib/booking-catalog';

type Program = {
  package_id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  available?: number;
  prices: { room_type: string; amount: number }[];
};

type Active = {
  reservation_number: string;
  package_id: string;
  package_name: string;
  room_type: string;
  total: number;
  paid: number;
} | null;

const money = (n: number) => `${Math.round(n || 0).toLocaleString('ar-DZ')} دج`;

function dateOf(v?: string) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric' }) : v;
}

/**
 * Super Admin, client drawer: move the client's trip to another program /
 * room, or give a client without a trip a new one. Server: /api/admin/client-trip.
 */
export default function ClientTripEditor({
  userId,
  hasActive,
  onSaved,
  onToast,
}: {
  userId: string;
  hasActive: boolean;
  onSaved: () => void;
  onToast: (text: string, tone?: 'ok' | 'error') => void;
}) {
  const [open, setOpen] = useState(false);
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [active, setActive] = useState<Active>(null);
  const [packageId, setPackageId] = useState('');
  const [roomType, setRoomType] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    fetch(`/api/admin/client-trip?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setPrograms(d.programs || []);
        setActive(d.active || null);
        if (d.active) {
          setPackageId(d.active.package_id);
          setRoomType(String(d.active.room_type || '').toUpperCase());
        }
      })
      .catch(() => setError('تعذّر تحميل البرامج'));
  }, [open, userId]);

  const program = programs?.find((p) => p.package_id === packageId) || null;
  const price = program?.prices.find((p) => p.room_type === roomType)?.amount ?? null;
  const unchanged = Boolean(active && active.package_id === packageId && String(active.room_type).toUpperCase() === roomType);

  const rooms = useMemo(() => program?.prices || [], [program]);
  useEffect(() => {
    if (program && !rooms.some((r) => r.room_type === roomType)) setRoomType(rooms[0]?.room_type || '');
  }, [program, rooms, roomType]);

  const save = async () => {
    if (!packageId || !roomType) return;
    setBusy(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/client-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, packageId, roomType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر حفظ الرحلة');
      onToast(data.message || 'تم');
      setOpen(false);
      onSaved();
      window.dispatchEvent(new CustomEvent('southstreet:bookings-updated'));
    } catch (e) {
      setError(keyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="tm-btn is-small tm-trip-edit-btn" onClick={() => setOpen(true)}>
        {hasActive ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        {hasActive ? 'تغيير البرنامج' : 'إضافة رحلة'}
      </button>
    );
  }

  return (
    <div className="tm-trip-editor">
      <strong>{active ? 'تغيير برنامج الرحلة' : 'إضافة رحلة لهذا العميل'}</strong>
      {programs === null && !error ? (
        <p className="tm-muted"><Loader2 className="w-4 h-4 animate-spin inline" /> جاري تحميل البرامج…</p>
      ) : null}
      {programs && programs.length === 0 ? <p className="tm-muted">لا توجد برامج منشورة قادمة.</p> : null}
      {programs && programs.length ? (
        <>
          <label>
            البرنامج
            <select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
              <option value="">اختر برنامج العمرة…</option>
              {programs.map((p) => (
                <option key={p.package_id} value={p.package_id}>
                  {p.name}{p.start_date ? ` — ${dateOf(p.start_date)}` : ''}{p.available != null ? ` · ${p.available} مقعد` : ''}
                </option>
              ))}
            </select>
          </label>
          {program ? (
            <label>
              الغرفة
              <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                {rooms.map((r) => (
                  <option key={r.room_type} value={r.room_type}>
                    {ROOM_LABELS[r.room_type] || r.room_type} — {money(r.amount)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {price != null ? (
            <dl className="tm-trip-editor-sum">
              {active ? <div><dt>السعر الحالي</dt><dd>{money(active.total)}</dd></div> : null}
              <div><dt>{active ? 'السعر الجديد' : 'السعر'}</dt><dd>{money(price)}</dd></div>
              {active ? <div><dt>المدفوع</dt><dd>{money(active.paid)}</dd></div> : null}
              <div><dt>المتبقي</dt><dd>{money(Math.max(0, price - (active?.paid || 0)))}</dd></div>
            </dl>
          ) : null}
          {active && price != null && active.paid > price ? (
            <p className="tm-trip-editor-warn">المدفوع يتجاوز السعر الجديد — يُسترجع الفرق عبر المحاسب أولاً.</p>
          ) : null}
          <p className="tm-muted">
            {active
              ? 'يبقى المدفوع كما هو، وتتغيّر المواعيد والمبلغ حسب البرنامج الجديد. يُطلب مفتاح الأمان ويُبلَّغ العميل.'
              : 'تُسجَّل الرحلة مقبولة من الوكالة، وتنتظر العربون عند المحاسب. يُبلَّغ العميل.'}
          </p>
        </>
      ) : null}
      {error ? <p className="tm-trip-editor-warn" role="alert">{error}</p> : null}
      <div className="tm-trip-editor-actions">
        <button type="button" className="tm-btn is-small" onClick={() => setOpen(false)} disabled={busy}>إلغاء</button>
        <button
          type="button"
          className="tm-btn is-primary is-small"
          onClick={save}
          disabled={busy || !packageId || !roomType || price == null || unchanged || Boolean(active && price != null && active.paid > price)}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {active ? 'حفظ التغيير' : 'إضافة الرحلة'}
        </button>
      </div>
    </div>
  );
}

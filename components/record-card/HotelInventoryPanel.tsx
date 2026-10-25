'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BedDouble, CalendarX2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { jsonAuthHeaders } from '@/lib/api-client';
import { HOTEL_COUNTRIES } from '@/lib/tour';
import { BOARD_LABEL, BOARD_TYPES, formatDzd, type BoardType } from '@/lib/hotels/types';

type Room = {
  room_id: string;
  name: string;
  beds: string;
  max_adults: number;
  max_children: number;
  size_m2: number | null;
  quantity: number;
  active: boolean;
  days: { day_key: string; allotment: number | null; stop_sell: boolean }[];
};
type Rate = {
  rate_id: string;
  room_id: string;
  board: BoardType;
  label: string;
  start_day: string;
  end_day: string;
  price_night: number;
  min_nights: number;
  free_cancel_days: number | null;
};
type HotelInfo = {
  bookable: boolean;
  country: string;
  area: string;
  stars: number;
  check_in_time: string;
  check_out_time: string;
  policies: string;
};

const input = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500';
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/**
 * Hotels card (Tables → الفنادق): what makes the hotel bookable online —
 * rooms, nightly prices by season and meal plan, rooms held per night and
 * stop-sale. Server: /api/admin/hotel-inventory.
 */
export default function HotelInventoryPanel({ hotelId }: { hotelId?: string | null }) {
  const [info, setInfo] = useState<HotelInfo | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(Boolean(hotelId));
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [roomForm, setRoomForm] = useState<Partial<Room> | null>(null);
  const [rateForm, setRateForm] = useState<Partial<Rate> | null>(null);
  const [daysForm, setDaysForm] = useState<{ room_id: string; from: string; to: string; allotment: string; stop_sell: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!hotelId) return setLoading(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/hotel-inventory?hotel_id=${encodeURIComponent(hotelId)}`, { headers: jsonAuthHeaders(), cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setInfo({
        bookable: Boolean(d.hotel.bookable),
        country: d.hotel.country || '',
        area: d.hotel.area || '',
        stars: Number(d.hotel.stars) || 0,
        check_in_time: d.hotel.check_in_time || '14:00',
        check_out_time: d.hotel.check_out_time || '12:00',
        policies: d.hotel.policies || '',
      });
      setRooms(d.rooms || []);
      setRates(d.rates || []);
    } catch (e: any) {
      setError(e?.message || 'تعذّر التحميل');
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (key: string, body: Record<string, unknown>, ok: string) => {
    setBusy(key);
    setError('');
    setNote('');
    try {
      const res = await fetch('/api/admin/hotel-inventory', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'تعذّر الحفظ');
      setNote(ok);
      await load();
      return true;
    } catch (e: any) {
      setError(e?.message || 'تعذّر الحفظ');
      return false;
    } finally {
      setBusy('');
    }
  };

  if (!hotelId) {
    return (
      <section className="pkg-offer trip-panel">
        <header className="pkg-offer-head">
          <div>
            <h3>الحجز عبر الموقع</h3>
            <p>احفظ الفندق أولاً، ثم أضف الغرف والأسعار ليُحجز من الموقع.</p>
          </div>
        </header>
      </section>
    );
  }

  const ready = rooms.some((r) => r.active && rates.some((x) => x.room_id === r.room_id));

  return (
    <section className="pkg-offer trip-panel hinv">
      <header className="pkg-offer-head">
        <div>
          <h3>الحجز عبر الموقع — الغرف والأسعار</h3>
          <p>
            {info?.bookable
              ? ready
                ? 'الفندق ظاهر في بحث الفنادق ويُحجز بهذه الأسعار.'
                : 'مفعّل للحجز، لكن أضف غرفة وسعراً واحداً على الأقل ليظهر في البحث.'
              : 'غير مفعّل للحجز — فعّله بعد إضافة الغرف والأسعار.'}
          </p>
        </div>
        {info ? (
          <button
            type="button"
            className={`hinv-switch${info.bookable ? ' is-on' : ''}`}
            role="switch"
            aria-checked={info.bookable}
            disabled={busy === 'hotel'}
            onClick={() => post('hotel', { action: 'save_hotel', hotel_id: hotelId, bookable: !info.bookable }, info.bookable ? 'أُوقف الحجز عبر الموقع' : 'فُعّل الحجز عبر الموقع ✓')}
          >
            <span />
            {info.bookable ? 'يُحجز' : 'متوقف'}
          </button>
        ) : null}
      </header>
      {error ? <p className="pkg-offer-error">{error}</p> : null}
      {note ? <p className="pkg-offer-note">{note}</p> : null}

      {loading || !info ? (
        <p className="pkg-offer-muted">جاري التحميل…</p>
      ) : (
        <div className="trip-form">
          {/* Hotel facts used by the search */}
          <div className="pkg-offer-block">
            <h4>معلومات الحجز</h4>
            <div className="hinv-grid">
              <label className="trip-label">البلد
                <select className={input} value={info.country} onChange={(e) => setInfo({ ...info, country: e.target.value })}>
                  <option value="">حسب المدينة</option>
                  {HOTEL_COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label className="trip-label">الحي / المنطقة
                <input className={input} value={info.area} placeholder="مثال: السلطان أحمد" onChange={(e) => setInfo({ ...info, area: e.target.value })} />
              </label>
              <label className="trip-label">النجوم
                <select className={input} value={info.stars || ''} onChange={(e) => setInfo({ ...info, stars: Number(e.target.value) || 0 })}>
                  <option value="">حسب الفئة</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                </select>
              </label>
              <label className="trip-label">الدخول من
                <input className={input} type="time" value={info.check_in_time} onChange={(e) => setInfo({ ...info, check_in_time: e.target.value })} />
              </label>
              <label className="trip-label">المغادرة قبل
                <input className={input} type="time" value={info.check_out_time} onChange={(e) => setInfo({ ...info, check_out_time: e.target.value })} />
              </label>
            </div>
            <label className="trip-label">شروط الفندق (الأطفال، الضريبة السياحية، الحيوانات…)
              <textarea className={input} rows={2} value={info.policies} onChange={(e) => setInfo({ ...info, policies: e.target.value })} />
            </label>
            <div className="hinv-actions">
              <button type="button" className="pkg-offer-save" disabled={busy === 'info'} onClick={() => post('info', { action: 'save_hotel', hotel_id: hotelId, ...info }, 'حُفظت معلومات الحجز ✓')}>
                {busy === 'info' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
              </button>
            </div>
          </div>

          {/* Rooms */}
          <div className="pkg-offer-block">
            <div className="trip-block-head">
              <h4>أنواع الغرف</h4>
              <button type="button" className="trip-add" onClick={() => setRoomForm({ name: '', beds: '', max_adults: 2, max_children: 1, quantity: 5, active: true })}>
                <Plus className="w-3.5 h-3.5" /> غرفة
              </button>
            </div>
            {rooms.length === 0 ? <p className="pkg-offer-muted">أضف أنواع الغرف (مزدوجة، ثلاثية، عائلية…) وعدد الغرف المحجوزة لكم كل ليلة.</p> : null}
            <div className="hinv-rooms">
              {rooms.map((r) => {
                const myRates = rates.filter((x) => x.room_id === r.room_id).sort((a, b) => a.start_day.localeCompare(b.start_day));
                const stops = r.days.filter((d) => d.stop_sell).length;
                return (
                  <article key={r.room_id} className={`hinv-room${r.active ? '' : ' is-off'}`}>
                    <header>
                      <BedDouble className="w-4 h-4" aria-hidden />
                      <strong>{r.name}</strong>
                      <small>
                        حتى {r.max_adults} بالغ{r.max_children ? ` + ${r.max_children} طفل` : ''} · {r.quantity} غرف/ليلة
                        {stops ? ` · ${stops} يوم إيقاف` : ''}
                      </small>
                      <span className="hinv-room-acts">
                        <button type="button" onClick={() => setRoomForm(r)}>تعديل</button>
                        <button type="button" onClick={() => setRateForm({ room_id: r.room_id, board: 'BB', start_day: today(), end_day: plusDays(180), min_nights: 1, free_cancel_days: 3, label: '' })}>+ سعر</button>
                        <button type="button" onClick={() => setDaysForm({ room_id: r.room_id, from: today(), to: plusDays(7), allotment: '', stop_sell: true })}>
                          <CalendarX2 className="w-3.5 h-3.5" /> التوفر
                        </button>
                      </span>
                    </header>
                    {myRates.length === 0 ? (
                      <p className="hinv-empty">لا سعر بعد — لن تظهر هذه الغرفة في البحث.</p>
                    ) : (
                      <ul className="hinv-rates">
                        {myRates.map((x) => (
                          <li key={x.rate_id}>
                            <b>{formatDzd(x.price_night)}</b> / ليلة · {BOARD_LABEL[x.board]}
                            <small>
                              {x.label ? `${x.label} · ` : ''}{x.start_day} ← {x.end_day}
                              {x.min_nights > 1 ? ` · ${x.min_nights} ليالٍ على الأقل` : ''}
                              {x.free_cancel_days == null ? ' · غير قابل للاسترداد' : ` · إلغاء مجاني حتى ${x.free_cancel_days} أيام قبل الوصول`}
                            </small>
                            <span className="hinv-room-acts">
                              <button type="button" onClick={() => setRateForm(x)}>تعديل</button>
                              <button type="button" className="is-del" aria-label="حذف السعر" onClick={() => post(`d${x.rate_id}`, { action: 'delete_rate', rate_id: x.rate_id }, 'حُذف السعر')}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {roomForm ? (
        <div className="hinv-dialog" role="dialog" aria-modal="true" onClick={() => setRoomForm(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (await post('room', { action: 'save_room', hotel_id: hotelId, ...roomForm }, 'حُفظت الغرفة ✓')) setRoomForm(null);
            }}
          >
            <h4>{roomForm.room_id ? 'تعديل الغرفة' : 'غرفة جديدة'}</h4>
            <label className="trip-label">الاسم<input className={input} required value={roomForm.name || ''} placeholder="غرفة مزدوجة مطلة على البحر" onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} /></label>
            <label className="trip-label">الأسرّة<input className={input} value={roomForm.beds || ''} placeholder="سرير كبير أو سريران" onChange={(e) => setRoomForm({ ...roomForm, beds: e.target.value })} /></label>
            <div className="hinv-grid">
              <label className="trip-label">بالغون (حد أقصى)<input className={input} type="number" min={1} max={10} value={roomForm.max_adults ?? 2} onChange={(e) => setRoomForm({ ...roomForm, max_adults: Number(e.target.value) })} /></label>
              <label className="trip-label">أطفال (حد أقصى)<input className={input} type="number" min={0} max={6} value={roomForm.max_children ?? 0} onChange={(e) => setRoomForm({ ...roomForm, max_children: Number(e.target.value) })} /></label>
              <label className="trip-label">المساحة م²<input className={input} type="number" min={0} value={roomForm.size_m2 ?? ''} onChange={(e) => setRoomForm({ ...roomForm, size_m2: Number(e.target.value) || null })} /></label>
              <label className="trip-label">غرف لكم كل ليلة<input className={input} type="number" min={0} max={500} value={roomForm.quantity ?? 5} onChange={(e) => setRoomForm({ ...roomForm, quantity: Number(e.target.value) })} /></label>
            </div>
            <label className="hinv-check"><input type="checkbox" checked={roomForm.active !== false} onChange={(e) => setRoomForm({ ...roomForm, active: e.target.checked })} /> متاحة للبيع</label>
            <div className="hinv-actions">
              {roomForm.room_id ? (
                <button type="button" className="hinv-del" onClick={async () => { if (await post('room', { action: 'delete_room', room_id: roomForm.room_id }, 'حُذفت الغرفة')) setRoomForm(null); }}>حذف</button>
              ) : null}
              <button type="button" className="hinv-ghost" onClick={() => setRoomForm(null)}>إلغاء</button>
              <button type="submit" className="pkg-offer-save" disabled={busy === 'room'}>{busy === 'room' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ</button>
            </div>
          </form>
        </div>
      ) : null}

      {rateForm ? (
        <div className="hinv-dialog" role="dialog" aria-modal="true" onClick={() => setRateForm(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (await post('rate', { action: 'save_rate', ...rateForm }, 'حُفظ السعر ✓')) setRateForm(null);
            }}
          >
            <h4>سعر الليلة — {rooms.find((r) => r.room_id === rateForm.room_id)?.name}</h4>
            <div className="hinv-grid">
              <label className="trip-label">سعر الليلة (دج)<input className={input} type="number" min={1} required value={rateForm.price_night ?? ''} onChange={(e) => setRateForm({ ...rateForm, price_night: Number(e.target.value) })} /></label>
              <label className="trip-label">الوجبات
                <select className={input} value={rateForm.board || 'BB'} onChange={(e) => setRateForm({ ...rateForm, board: e.target.value as BoardType })}>
                  {BOARD_TYPES.map((b) => <option key={b} value={b}>{BOARD_LABEL[b]}</option>)}
                </select>
              </label>
              <label className="trip-label">من<input className={input} type="date" required value={rateForm.start_day || ''} onChange={(e) => setRateForm({ ...rateForm, start_day: e.target.value })} /></label>
              <label className="trip-label">إلى<input className={input} type="date" required value={rateForm.end_day || ''} onChange={(e) => setRateForm({ ...rateForm, end_day: e.target.value })} /></label>
              <label className="trip-label">أقل عدد ليالٍ<input className={input} type="number" min={1} max={30} value={rateForm.min_nights ?? 1} onChange={(e) => setRateForm({ ...rateForm, min_nights: Number(e.target.value) })} /></label>
              <label className="trip-label">اسم الموسم (اختياري)<input className={input} value={rateForm.label || ''} placeholder="صيف 2027" onChange={(e) => setRateForm({ ...rateForm, label: e.target.value })} /></label>
            </div>
            <label className="trip-label">الإلغاء
              <select
                className={input}
                value={rateForm.free_cancel_days == null ? 'none' : String(rateForm.free_cancel_days)}
                onChange={(e) => setRateForm({ ...rateForm, free_cancel_days: e.target.value === 'none' ? null : Number(e.target.value) })}
              >
                <option value="none">غير قابل للاسترداد</option>
                {[0, 1, 2, 3, 5, 7, 14, 21, 30].map((n) => <option key={n} value={n}>{n === 0 ? 'إلغاء مجاني حتى يوم الوصول' : `إلغاء مجاني حتى ${n} أيام قبل الوصول`}</option>)}
              </select>
            </label>
            <p className="pkg-offer-muted">عند تداخل فترتين، تُطبَّق الفترة الأقصر (سعر موسم أو عطلة داخل سعر السنة).</p>
            <div className="hinv-actions">
              <button type="button" className="hinv-ghost" onClick={() => setRateForm(null)}>إلغاء</button>
              <button type="submit" className="pkg-offer-save" disabled={busy === 'rate'}>{busy === 'rate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ</button>
            </div>
          </form>
        </div>
      ) : null}

      {daysForm ? (
        <div className="hinv-dialog" role="dialog" aria-modal="true" onClick={() => setDaysForm(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await post('days', {
                action: 'set_days',
                room_id: daysForm.room_id,
                from: daysForm.from,
                to: daysForm.to,
                allotment: daysForm.allotment === '' ? null : Number(daysForm.allotment),
                stop_sell: daysForm.stop_sell,
              }, daysForm.stop_sell ? 'أُوقف البيع في هذه الفترة' : 'حُدّث التوفر ✓');
              if (ok) setDaysForm(null);
            }}
          >
            <h4>التوفر — {rooms.find((r) => r.room_id === daysForm.room_id)?.name}</h4>
            <div className="hinv-grid">
              <label className="trip-label">من<input className={input} type="date" required value={daysForm.from} onChange={(e) => setDaysForm({ ...daysForm, from: e.target.value })} /></label>
              <label className="trip-label">إلى<input className={input} type="date" required value={daysForm.to} onChange={(e) => setDaysForm({ ...daysForm, to: e.target.value })} /></label>
              <label className="trip-label">غرف لكم كل ليلة (فارغ = العدد الافتراضي)<input className={input} type="number" min={0} value={daysForm.allotment} onChange={(e) => setDaysForm({ ...daysForm, allotment: e.target.value })} /></label>
            </div>
            <label className="hinv-check"><input type="checkbox" checked={daysForm.stop_sell} onChange={(e) => setDaysForm({ ...daysForm, stop_sell: e.target.checked })} /> إيقاف البيع في هذه الفترة</label>
            <div className="hinv-actions">
              <button type="button" className="hinv-ghost" onClick={() => setDaysForm(null)}>إلغاء</button>
              <button type="submit" className="pkg-offer-save" disabled={busy === 'days'}>{busy === 'days' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

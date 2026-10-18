'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { jsonAuthHeaders } from '@/lib/api-client';
import {
  DESTINATIONS,
  EMPTY_TOUR,
  TRIP_KIND_OPTIONS,
  destinationOf,
  parseTour,
  tripKindOf,
  type TourDetails,
  type TripKind,
} from '@/lib/tour';

const linesOf = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * Program card (Tables → باقات): what kind of program it is, and for a tourist
 * trip everything the public page shows — country, cities, day-by-day plan,
 * hotels, highlights, visa note. Saved with /api/admin/packages {tour_only}.
 */
export default function TripDetailsPanel({
  packageId,
  onKindChange,
}: {
  packageId?: string | null;
  onKindChange?: (kind: TripKind) => void;
}) {
  const [kind, setKind] = useState<TripKind>('UMRAH');
  const [tour, setTour] = useState<TourDetails>(EMPTY_TOUR);
  const [citiesText, setCitiesText] = useState('');
  const [highlightsText, setHighlightsText] = useState('');
  const [loading, setLoading] = useState(Boolean(packageId));
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!packageId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/packages', { headers: jsonAuthHeaders(), cache: 'no-store' });
      const rows = await res.json();
      const pkg = Array.isArray(rows) ? rows.find((r: { package_id?: string }) => r.package_id === packageId) : null;
      if (pkg) {
        const k = tripKindOf(pkg);
        const t = parseTour(pkg.tour);
        setKind(k);
        setTour(t);
        setCitiesText(t.cities.join('\n'));
        setHighlightsText(t.highlights.join('\n'));
        onKindChange?.(k);
      }
    } catch {
      setError('تعذّر تحميل تفاصيل الرحلة');
    } finally {
      setLoading(false);
    }
  }, [packageId, onKindChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (p: Partial<TourDetails>) => {
    setTour((t) => ({ ...t, ...p }));
    setNote('');
  };

  const pickCountry = (value: string) => {
    const d = destinationOf(value);
    const next: Partial<TourDetails> = { country: value };
    // A fresh trip gets the destination's visa note and main cities to start from.
    if (d && !tour.visa) next.visa = d.visa;
    if (d && !citiesText.trim()) setCitiesText(d.cities.slice(0, 2).join('\n'));
    patch(next);
  };

  const save = async () => {
    if (!packageId) return;
    setSaving(true);
    setError('');
    setNote('');
    try {
      const payload = { ...tour, cities: linesOf(citiesText), highlights: linesOf(highlightsText) };
      const res = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ tour_only: true, package_id: packageId, trip_type: kind, tour: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) setError(data.error || 'تعذّر الحفظ');
      else {
        setNote(kind === 'TOURISM' ? 'حُفظت تفاصيل الرحلة السياحية ✓' : 'حُفظ نوع البرنامج ✓');
        onKindChange?.(kind);
      }
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  const days = tour.itinerary;
  const setDay = (i: number, p: Partial<(typeof days)[number]>) =>
    patch({ itinerary: days.map((d, j) => (j === i ? { ...d, ...p } : d)) });
  const hotels = tour.hotels;
  const setHotel = (i: number, p: Partial<(typeof hotels)[number]>) =>
    patch({ hotels: hotels.map((h, j) => (j === i ? { ...h, ...p } : h)) });
  const cityChoices = destinationOf(tour.country)?.cities || [];

  const input = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <section className="pkg-offer trip-panel">
      <header className="pkg-offer-head">
        <div>
          <h3>نوع البرنامج والرحلة السياحية</h3>
          <p>
            {packageId
              ? kind === 'TOURISM'
                ? 'البلد والمدن وبرنامج الأيام والفنادق — تظهر في صفحة «رحلات سياحية».'
                : 'برنامج عمرة / حج — اختر «رحلة سياحية» لبرنامج إلى تركيا، ماليزيا، مصر، تونس، إسبانيا أو لندن.'
              : 'احفظ البرنامج أولاً، ثم اختر نوعه وأضف تفاصيل الرحلة.'}
          </p>
        </div>
        {packageId ? (
          <button type="button" className="pkg-offer-save" onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ
          </button>
        ) : null}
      </header>
      {error ? <p className="pkg-offer-error">{error}</p> : null}
      {note ? <p className="pkg-offer-note">{note}</p> : null}

      {!packageId ? null : loading ? (
        <p className="pkg-offer-muted">جاري التحميل…</p>
      ) : (
        <>
          <div className="trip-kinds" role="radiogroup" aria-label="نوع البرنامج">
            {TRIP_KIND_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={kind === o.value}
                className={kind === o.value ? 'is-on' : ''}
                onClick={() => {
                  setKind(o.value);
                  setNote('');
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {kind === 'TOURISM' ? (
            <div className="trip-form">
              <div className="pkg-offer-block">
                <h4>الوجهة</h4>
                <div className="trip-dests">
                  {DESTINATIONS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={tour.country === d.id ? 'is-on' : ''}
                      onClick={() => pickCountry(d.id)}
                    >
                      <i aria-hidden style={{ background: d.color }} /> {d.label}
                    </button>
                  ))}
                </div>
                <label className="trip-label">
                  أو بلد آخر
                  <input
                    className={input}
                    value={destinationOf(tour.country) ? '' : tour.country}
                    placeholder="اكتب اسم البلد…"
                    onChange={(e) => patch({ country: e.target.value })}
                  />
                </label>
                <label className="trip-label">
                  المدن (مدينة في كل سطر)
                  <textarea className={input} rows={3} value={citiesText} onChange={(e) => { setCitiesText(e.target.value); setNote(''); }} />
                </label>
                {cityChoices.length ? (
                  <div className="trip-suggest">
                    {cityChoices.filter((c) => !linesOf(citiesText).includes(c)).map((c) => (
                      <button key={c} type="button" onClick={() => setCitiesText((t) => (t.trim() ? `${t.trim()}\n${c}` : c))}>
                        + {c}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="pkg-offer-block">
                <div className="trip-block-head">
                  <h4>برنامج الرحلة يوماً بيوم</h4>
                  <button type="button" className="trip-add" onClick={() => patch({ itinerary: [...days, { day: days.length + 1, title: '', details: '' }] })}>
                    <Plus className="w-3.5 h-3.5" /> يوم
                  </button>
                </div>
                {days.length === 0 ? <p className="pkg-offer-muted">أضف أيام الرحلة: الوصول، الجولات، الرجوع…</p> : null}
                <ol className="trip-days">
                  {days.map((d, i) => (
                    <li key={i}>
                      <span className="trip-day-n">اليوم {i + 1}</span>
                      <input className={input} placeholder="العنوان — مثال: جولة في البوسفور" value={d.title} onChange={(e) => setDay(i, { title: e.target.value, day: i + 1 })} />
                      <textarea className={input} rows={2} placeholder="التفاصيل (اختياري)" value={d.details || ''} onChange={(e) => setDay(i, { details: e.target.value })} />
                      <button type="button" className="trip-del" aria-label="حذف اليوم" onClick={() => patch({ itinerary: days.filter((_, j) => j !== i).map((x, j) => ({ ...x, day: j + 1 })) })}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="pkg-offer-block">
                <div className="trip-block-head">
                  <h4>الفنادق</h4>
                  <button type="button" className="trip-add" onClick={() => patch({ hotels: [...hotels, { city: '', name: '', stars: 4, nights: 3 }] })}>
                    <Plus className="w-3.5 h-3.5" /> فندق
                  </button>
                </div>
                {hotels.map((h, i) => (
                  <div key={i} className="trip-hotel">
                    <input className={input} placeholder="المدينة" value={h.city} onChange={(e) => setHotel(i, { city: e.target.value })} />
                    <input className={input} placeholder="اسم الفندق" value={h.name} onChange={(e) => setHotel(i, { name: e.target.value })} />
                    <select className={input} value={h.stars || ''} onChange={(e) => setHotel(i, { stars: Number(e.target.value) || undefined })} aria-label="النجوم">
                      <option value="">النجوم</option>
                      {[3, 4, 5].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                    </select>
                    <input className={input} type="number" min={1} placeholder="ليالٍ" value={h.nights || ''} onChange={(e) => setHotel(i, { nights: Number(e.target.value) || undefined })} aria-label="عدد الليالي" />
                    <button type="button" className="trip-del" aria-label="حذف الفندق" onClick={() => patch({ hotels: hotels.filter((_, j) => j !== i) })}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pkg-offer-block">
                <label className="trip-label">
                  أبرز ما في الرحلة (سطر لكل نقطة)
                  <textarea className={input} rows={4} placeholder={'رحلة بحرية في البوسفور\nزيارة آيا صوفيا\nيوم حر للتسوق'} value={highlightsText} onChange={(e) => { setHighlightsText(e.target.value); setNote(''); }} />
                </label>
                <label className="trip-label">
                  التأشيرة
                  <textarea className={input} rows={2} value={tour.visa} onChange={(e) => patch({ visa: e.target.value })} />
                </label>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

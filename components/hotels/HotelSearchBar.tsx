'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BedDouble, Building2, CalendarDays, Globe2, MapPin, Minus, Plus, Search, Users } from 'lucide-react';
import DateRangePicker from '@/components/hotels/DateRangePicker';
import { arDate, encodeRooms, guestsSummary, isoDay, nightsBetween, type GuestRoom, type HotelSearch } from '@/lib/hotels/types';

type Suggestion = { type: 'country' | 'city' | 'hotel'; value: string; label: string; sub?: string; count?: number };

const ICON = { country: Globe2, city: MapPin, hotel: Building2 };

export function searchHref(s: HotelSearch & { label?: string }) {
  const q = new URLSearchParams({ dest: s.dest, checkIn: s.checkIn, checkOut: s.checkOut, rooms: encodeRooms(s.rooms) });
  if (s.label) q.set('label', s.label);
  return `/hotels/search?${q}`;
}

export function defaultDates() {
  const a = new Date(Date.now() + 14 * 864e5);
  return { checkIn: isoDay(a), checkOut: isoDay(new Date(a.getTime() + 3 * 864e5)) };
}

/**
 * Hotel search: destination (country, city or hotel, with suggestions),
 * dates (range calendar) and rooms & guests. Submitting opens /hotels/search.
 */
export default function HotelSearchBar({
  initial,
  initialLabel,
  variant = 'hero',
  onSearch,
}: {
  initial?: Partial<HotelSearch>;
  initialLabel?: string;
  variant?: 'hero' | 'compact';
  onSearch?: (s: HotelSearch & { label: string }) => void;
}) {
  const router = useRouter();
  const dd = defaultDates();
  const [dest, setDest] = useState(initial?.dest || '');
  const [label, setLabel] = useState(initialLabel || initial?.dest || '');
  const [checkIn, setCheckIn] = useState(initial?.checkIn || dd.checkIn);
  const [checkOut, setCheckOut] = useState(initial?.checkOut || dd.checkOut);
  const [rooms, setRooms] = useState<GuestRoom[]>(initial?.rooms?.length ? initial.rooms : [{ adults: 2, children: 0, childAges: [] }]);
  const [open, setOpen] = useState<'' | 'dest' | 'dates' | 'guests'>('');
  const [sugg, setSugg] = useState<Suggestion[]>([]);
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen('');
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (open !== 'dest') return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/hotels/destinations?q=${encodeURIComponent(label === dest ? '' : label)}`, { signal: ctrl.signal, cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setSugg(Array.isArray(d.suggestions) ? d.suggestions : []))
        .catch(() => {});
    }, 160);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [label, open, dest]);

  const submit = () => {
    const where = dest || label.trim();
    if (!where) {
      setError('اختر البلد أو المدينة');
      setOpen('dest');
      return;
    }
    if (!checkIn || !checkOut) {
      setError('اختر التواريخ');
      setOpen('dates');
      return;
    }
    setError('');
    setOpen('');
    const s = { dest: where, checkIn, checkOut, rooms, label: label || where };
    if (onSearch) onSearch(s);
    else router.push(searchHref(s));
  };

  const setRoom = (i: number, p: Partial<GuestRoom>) =>
    setRooms((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...p };
        next.childAges = Array.from({ length: next.children }, (_, k) => next.childAges[k] ?? 8);
        return next;
      })
    );

  const nights = nightsBetween(checkIn, checkOut);

  return (
    <div className={`hsb is-${variant}`} ref={box} dir="rtl">
      <div className="hsb-row">
        <div className={`hsb-field is-dest${open === 'dest' ? ' is-open' : ''}`}>
          <MapPin aria-hidden />
          <label>
            <small>الوجهة</small>
            <input
              value={label}
              placeholder="بلد، مدينة أو فندق"
              onFocus={() => setOpen('dest')}
              onChange={(e) => {
                setLabel(e.target.value);
                setDest('');
                setOpen('dest');
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              aria-label="الوجهة"
            />
          </label>
          {open === 'dest' && sugg.length ? (
            <ul className="hsb-pop hsb-sugg" role="listbox">
              {sugg.map((s) => {
                const Icon = ICON[s.type];
                return (
                  <li key={`${s.type}-${s.value}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={dest === s.value}
                      onClick={() => {
                        setDest(s.value);
                        setLabel(s.label);
                        setOpen('dates');
                      }}
                    >
                      <span className={`hsb-sugg-ico is-${s.type}`}><Icon aria-hidden /></span>
                      <span>
                        <b>{s.label}</b>
                        <small>{s.sub}{s.count ? ` · ${s.count} ${s.count === 1 ? 'فندق' : 'فنادق'}` : ''}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div className={`hsb-field is-dates${open === 'dates' ? ' is-open' : ''}`}>
          <CalendarDays aria-hidden />
          <button type="button" className="hsb-btn" onClick={() => setOpen(open === 'dates' ? '' : 'dates')}>
            <small>التواريخ{nights > 0 ? ` · ${nights} ${nights === 1 ? 'ليلة' : 'ليالٍ'}` : ''}</small>
            <b>{checkIn ? arDate(checkIn) : 'الوصول'} ← {checkOut ? arDate(checkOut) : 'المغادرة'}</b>
          </button>
          {open === 'dates' ? (
            <div className="hsb-pop hsb-cal">
              <DateRangePicker
                checkIn={checkIn}
                checkOut={checkOut}
                onChange={(a, b, done) => {
                  setCheckIn(a);
                  setCheckOut(b);
                  if (done) setOpen('guests');
                }}
              />
            </div>
          ) : null}
        </div>

        <div className={`hsb-field is-guests${open === 'guests' ? ' is-open' : ''}`}>
          <Users aria-hidden />
          <button type="button" className="hsb-btn" onClick={() => setOpen(open === 'guests' ? '' : 'guests')}>
            <small>الغرف والضيوف</small>
            <b>{guestsSummary(rooms)}</b>
          </button>
          {open === 'guests' ? (
            <div className="hsb-pop hsb-guests">
              {rooms.map((r, i) => (
                <div key={i} className="hsb-room">
                  <header>
                    <BedDouble aria-hidden /> الغرفة {i + 1}
                    {rooms.length > 1 ? (
                      <button type="button" onClick={() => setRooms((rs) => rs.filter((_, j) => j !== i))}>إزالة</button>
                    ) : null}
                  </header>
                  <div className="hsb-step">
                    <span>بالغون</span>
                    <button type="button" aria-label="أقل" disabled={r.adults <= 1} onClick={() => setRoom(i, { adults: r.adults - 1 })}><Minus /></button>
                    <b>{r.adults}</b>
                    <button type="button" aria-label="أكثر" disabled={r.adults >= 6} onClick={() => setRoom(i, { adults: r.adults + 1 })}><Plus /></button>
                  </div>
                  <div className="hsb-step">
                    <span>أطفال <small>(أقل من 18)</small></span>
                    <button type="button" aria-label="أقل" disabled={r.children <= 0} onClick={() => setRoom(i, { children: r.children - 1 })}><Minus /></button>
                    <b>{r.children}</b>
                    <button type="button" aria-label="أكثر" disabled={r.children >= 4} onClick={() => setRoom(i, { children: r.children + 1 })}><Plus /></button>
                  </div>
                  {r.children ? (
                    <div className="hsb-ages">
                      {r.childAges.map((age, k) => (
                        <label key={k}>
                          عمر الطفل {k + 1}
                          <select value={age} onChange={(e) => setRoom(i, { childAges: r.childAges.map((a, x) => (x === k ? Number(e.target.value) : a)) })}>
                            {Array.from({ length: 18 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'أقل من سنة' : `${n} سنة`}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              <div className="hsb-guests-foot">
                {rooms.length < 5 ? (
                  <button type="button" className="hsb-add" onClick={() => setRooms((rs) => [...rs, { adults: 2, children: 0, childAges: [] }])}>
                    <Plus aria-hidden /> غرفة أخرى
                  </button>
                ) : <span />}
                <button type="button" className="hsb-done" onClick={() => setOpen('')}>تم</button>
              </div>
            </div>
          ) : null}
        </div>

        <button type="button" className="hsb-go" onClick={submit}>
          <Search aria-hidden /> <span>ابحث</span>
        </button>
      </div>
      {error ? <p className="hsb-error" role="alert">{error}</p> : null}
    </div>
  );
}

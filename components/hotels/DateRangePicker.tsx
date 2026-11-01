'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DAY, isoDay, nightsBetween, parseDay } from '@/lib/hotels/types';

const WEEK = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

function monthDays(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = first.getUTCDay(); // Sunday = 0
  return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => isoDay(new Date(Date.UTC(year, month, i + 1))))];
}

/**
 * Two-month range calendar (one month on phones): tap the arrival, then the
 * departure. Past days are disabled; the hovered range is highlighted.
 */
export default function DateRangePicker({
  checkIn,
  checkOut,
  onChange,
  maxNights = 30,
}: {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string, done: boolean) => void;
  maxNights?: number;
}) {
  const today = isoDay(new Date());
  const start = parseDay(checkIn) || new Date();
  const [view, setView] = useState({ y: start.getUTCFullYear(), m: start.getUTCMonth() });
  const [hover, setHover] = useState('');
  const picking = Boolean(checkIn && !checkOut);

  const months = useMemo(() => {
    const a = { y: view.y, m: view.m };
    const b = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 };
    return [a, b];
  }, [view]);

  const end = checkOut || (picking ? hover : '');
  const inRange = (d: string) => Boolean(checkIn && end && d > checkIn && d < end);

  const pick = (d: string) => {
    if (!checkIn || checkOut || d <= checkIn) return onChange(d, '', false);
    const n = nightsBetween(checkIn, d);
    if (n > maxNights) return onChange(checkIn, isoDay(new Date(parseDay(checkIn)!.getTime() + maxNights * DAY)), true);
    onChange(checkIn, d, true);
  };

  const step = (delta: number) => {
    const m = view.m + delta;
    const next = { y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    const now = new Date();
    if (next.y < now.getUTCFullYear() || (next.y === now.getUTCFullYear() && next.m < now.getUTCMonth())) return;
    setView(next);
  };

  return (
    <div className="drp" dir="rtl">
      <div className="drp-nav">
        <button type="button" onClick={() => step(-1)} aria-label="الشهر السابق"><ChevronRight /></button>
        <span>{checkIn && checkOut ? `${nightsBetween(checkIn, checkOut)} ليالٍ` : checkIn ? 'اختر تاريخ المغادرة' : 'اختر تاريخ الوصول'}</span>
        <button type="button" onClick={() => step(1)} aria-label="الشهر التالي"><ChevronLeft /></button>
      </div>
      <div className="drp-months">
        {months.map(({ y, m }, idx) => (
          <div key={`${y}-${m}`} className={`drp-month${idx === 1 ? ' is-second' : ''}`}>
            <strong>{new Date(Date.UTC(y, m, 1)).toLocaleDateString('ar-DZ', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong>
            <div className="drp-grid" role="grid">
              {WEEK.map((w) => <span key={w} className="drp-wd">{w}</span>)}
              {monthDays(y, m).map((d, i) =>
                d ? (
                  <button
                    key={d}
                    type="button"
                    disabled={d < today}
                    className={[
                      'drp-day',
                      d === checkIn ? 'is-start' : '',
                      d === end ? 'is-end' : '',
                      inRange(d) ? 'is-in' : '',
                      d === today ? 'is-today' : '',
                    ].join(' ')}
                    onClick={() => pick(d)}
                    onMouseEnter={() => picking && setHover(d)}
                    aria-label={d}
                    aria-pressed={d === checkIn || d === checkOut}
                  >
                    {Number(d.slice(8))}
                  </button>
                ) : (
                  <span key={`e${i}`} />
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Timer } from 'lucide-react';

function partsFrom(ms: number) {
  const safe = Math.max(0, ms);
  const days = Math.floor(safe / 86400000);
  const hours = Math.floor((safe % 86400000) / 3600000);
  const minutes = Math.floor((safe % 3600000) / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatTripDay(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' });
}

export default function UmrahCountdown({
  startDate,
  packageName,
  variant = 'board',
}: {
  startDate?: string | null;
  packageName?: string;
  variant?: 'board' | 'quiet';
}) {
  const target = useMemo(() => {
    if (!startDate) return null;
    const d = new Date(startDate);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(6, 0, 0, 0);
    return d;
  }, [startDate]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const tick = window.setInterval(() => setNow(Date.now()), variant === 'quiet' ? 60000 : 1000);
    return () => window.clearInterval(tick);
  }, [target, variant]);

  if (!target) return null;

  const remaining = target.getTime() - now;
  const arrived = remaining <= 0;
  const { days, hours, minutes, seconds } = partsFrom(remaining);
  const dayLabel = formatTripDay(startDate);

  if (variant === 'quiet') {
    const headline = arrived
      ? 'عمرتك بدأت'
      : days > 0
        ? `${days} يوم`
        : hours > 0
          ? `${hours} ساعة`
          : 'قريب';
    return (
      <div className="home-trip-count" aria-live="polite">
        <strong>{headline}</strong>
        {dayLabel && !arrived ? <em>{dayLabel}</em> : null}
      </div>
    );
  }

  return (
    <aside className="umrah-countdown" dir="rtl" aria-live="polite">
      <div className="umrah-countdown-head">
        <Timer className="w-4 h-4" />
        <div>
          <p>{arrived ? 'حان الموعد' : 'باقي على السفر'}</p>
          {packageName ? <span>{packageName}</span> : null}
        </div>
      </div>
      {arrived ? (
        <p className="umrah-countdown-live">تقبّل الله عمرتكم — برنامجكم بدأ</p>
      ) : (
        <div className="umrah-countdown-units">
          <div><b>{days}</b><em>يوم</em></div>
          <div><b>{pad(hours)}</b><em>ساعة</em></div>
          <div><b>{pad(minutes)}</b><em>دقيقة</em></div>
          <div><b>{pad(seconds)}</b><em>ثانية</em></div>
        </div>
      )}
    </aside>
  );
}

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

export default function UmrahCountdown({
  startDate,
  packageName,
}: {
  startDate?: string | null;
  packageName?: string;
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
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [target]);

  if (!target) return null;

  const remaining = target.getTime() - now;
  const arrived = remaining <= 0;
  const { days, hours, minutes, seconds } = partsFrom(remaining);

  return (
    <aside className="umrah-countdown" dir="rtl" aria-live="polite">
      <div className="umrah-countdown-head">
        <Timer className="w-4 h-4" />
        <div>
          <p>{arrived ? 'حان موعد العمرة' : 'العدّ التنازلي لموعد العمرة'}</p>
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

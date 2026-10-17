'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { authHeaders } from '@/lib/api-client';

type Live = { online: number; total: number; calls: number; groups: number };

/**
 * The way into the SS Connect control room (/connect-admin), at the bottom of
 * the main dashboard's side menu — Super Admin only, with live numbers
 * (refreshed every 30 s). With the menu folded it is just the Connect icon.
 */
export default function ConnectLaunchButton() {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/connect/admin?view=overview', { headers: authHeaders(), cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        if (alive) setLive({ online: d.users?.online ?? 0, total: d.users?.total ?? 0, calls: d.live?.length ?? 0, groups: d.groups ?? 0 });
      } catch {
        /* numbers are a bonus */
      }
    };
    void load();
    const t = window.setInterval(() => document.visibilityState === 'visible' && void load(), 30_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  return (
    <a href="/connect-admin" className="inn-connect-launch" title="لوحة SS Connect">
      <img src="/icons/connect-192.png" alt="" className="inn-connect-launch-icon" />
      <span className="inn-side-label inn-connect-launch-text">
        <b>لوحة SS Connect</b>
        <small>
          {live ? (
            <>
              {live.online}/{live.total} متصل · <span className={live.calls ? 'is-live' : ''}>{live.calls} مكالمة</span> · {live.groups} مجموعة
            </>
          ) : 'المكالمات والرسائل والمجموعات'}
        </small>
      </span>
      <ChevronLeft className="w-5 h-5 inn-side-label inn-connect-launch-go" aria-hidden />
    </a>
  );
}

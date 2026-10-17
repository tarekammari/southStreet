'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, MessageCircle, Phone, Users } from 'lucide-react';
import { authHeaders } from '@/lib/api-client';

type Live = { online: number; total: number; calls: number; groups: number };

/**
 * The big way into the SS Connect control room (/connect-admin) from the main
 * dashboard — Super Admin only, with live numbers (refreshed every 30 s).
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
    <a href="/connect-admin" className="inn-connect-launch">
      <span className="inn-connect-launch-icon">
        <img src="/icons/connect-192.png" alt="" />
      </span>
      <span className="inn-connect-launch-text">
        <b>لوحة SS Connect</b>
        <small>المكالمات والرسائل والمجموعات — إيقاف وإعلانات وقواعد عامة</small>
      </span>
      {live ? (
        <span className="inn-connect-launch-stats" aria-label="الآن في SS Connect">
          <span><Users className="w-4 h-4" /> {live.online}<em>/{live.total} متصل</em></span>
          <span className={live.calls ? 'is-live' : ''}><Phone className="w-4 h-4" /> {live.calls}<em> مكالمة</em></span>
          <span><MessageCircle className="w-4 h-4" /> {live.groups}<em> مجموعة</em></span>
        </span>
      ) : null}
      <ChevronLeft className="w-6 h-6 inn-connect-launch-go" aria-hidden />
    </a>
  );
}

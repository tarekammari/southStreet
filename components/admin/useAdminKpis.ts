'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authHeaders, getAuthToken } from '@/lib/api-client';

export const ADMIN_KPI_POLL_MS = 10000;

export type AdminKpis = {
  pendingAccess: number;
  pendingBookings: number;
  openSecurity: number;
  serverStatus: 'ok' | 'warn' | 'hot' | 'unknown';
  serverLabel: string;
};

export const EMPTY_ADMIN_KPIS: AdminKpis = {
  pendingAccess: 0,
  pendingBookings: 0,
  openSecurity: 0,
  serverStatus: 'unknown',
  serverLabel: '—',
};

export type AdminKpiPulse = {
  pendingAccess: boolean;
  pendingBookings: boolean;
  openSecurity: boolean;
};

/** Lightweight admin KPI polling from existing APIs (no secrets). */
export function useAdminKpis(enabled: boolean, externalPendingAccess?: number) {
  const [kpis, setKpis] = useState<AdminKpis>(EMPTY_ADMIN_KPIS);
  const [live, setLive] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pulse, setPulse] = useState<AdminKpiPulse>({
    pendingAccess: false,
    pendingBookings: false,
    openSecurity: false,
  });
  const prev = useRef<AdminKpis>(EMPTY_ADMIN_KPIS);
  const pulseTimers = useRef<number[]>([]);

  const bump = useCallback((key: keyof AdminKpiPulse) => {
    setPulse((p) => ({ ...p, [key]: true }));
    const id = window.setTimeout(() => {
      setPulse((p) => ({ ...p, [key]: false }));
    }, 900);
    pulseTimers.current.push(id);
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const token = getAuthToken();
    if (!token) return;

    try {
      const headers = authHeaders();
      const [usersRes, bookingsRes, securityRes, healthRes] = await Promise.all([
        fetch('/api/admin/users', { cache: 'no-store', headers, credentials: 'same-origin' }),
        fetch('/api/bookings/confirm', { cache: 'no-store', headers, credentials: 'same-origin' }),
        fetch('/api/security/monitor?limit=200&all=1', { cache: 'no-store', headers, credentials: 'same-origin' }),
        fetch('/api/admin/server-health', { cache: 'no-store', headers, credentials: 'same-origin' }),
      ]);

      if ([usersRes, bookingsRes, securityRes, healthRes].some((r) => r.status === 401)) {
        setSessionExpired(true);
        setLive(false);
        return;
      }

      let pendingAccess = typeof externalPendingAccess === 'number' ? externalPendingAccess : 0;
      if (usersRes.ok) {
        const data = await usersRes.json();
        pendingAccess = Number(data?.stats?.pending ?? pendingAccess) || 0;
      }

      let pendingBookings = 0;
      if (bookingsRes.ok) {
        const data = await bookingsRes.json();
        const list = Array.isArray(data?.demands) ? data.demands : data?.pending || [];
        pendingBookings = Array.isArray(list) ? list.length : 0;
      }

      let openSecurity = 0;
      if (securityRes.ok) {
        const data = await securityRes.json();
        const events = Array.isArray(data?.events)
          ? data.events
          : Array.isArray(data?.feed)
            ? data.feed
            : [];
        openSecurity = events.filter((e: { blocked?: boolean; threat?: string; severity?: string }) => {
          const sev = String(e?.severity || '').toLowerCase();
          return Boolean(e?.blocked) || e?.threat !== 'CLEAN' || sev === 'high' || sev === 'critical';
        }).length;
        if (!events.length && data?.summary) {
          openSecurity = Number(data.summary.totalThreats || data.summary.totalBlocked || 0) || 0;
        }
      }

      let serverStatus: AdminKpis['serverStatus'] = 'unknown';
      let serverLabel = 'غير متاح';
      if (healthRes.ok) {
        const data = await healthRes.json();
        const st = String(data?.status || '').toLowerCase();
        if (st === 'ok' || st === 'warn' || st === 'hot') serverStatus = st as AdminKpis['serverStatus'];
        serverLabel =
          serverStatus === 'ok'
            ? 'سليم'
            : serverStatus === 'warn'
              ? 'تحذير'
              : serverStatus === 'hot'
                ? 'حار'
                : '—';
      }

      const next: AdminKpis = {
        pendingAccess,
        pendingBookings,
        openSecurity,
        serverStatus,
        serverLabel,
      };

      if (next.pendingAccess > prev.current.pendingAccess) bump('pendingAccess');
      if (next.pendingBookings > prev.current.pendingBookings) bump('pendingBookings');
      if (next.openSecurity > prev.current.openSecurity) bump('openSecurity');
      prev.current = next;
      setKpis(next);
      setLive(true);
      setSessionExpired(false);
    } catch {
      setLive(false);
    }
  }, [bump, enabled, externalPendingAccess]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void refresh();
    const id = window.setInterval(() => {
      if (alive) void refresh();
    }, ADMIN_KPI_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
      pulseTimers.current.forEach((t) => window.clearTimeout(t));
      pulseTimers.current = [];
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (typeof externalPendingAccess === 'number') {
      setKpis((k) => ({ ...k, pendingAccess: externalPendingAccess }));
    }
  }, [externalPendingAccess]);

  return { kpis, live, sessionExpired, pulse, refresh, setSessionExpired };
}

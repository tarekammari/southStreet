'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BedDouble, MoonStar, Plane, type LucideIcon } from 'lucide-react';
import { authHeaders } from '@/lib/api-client';
import { publicList } from '@/lib/public-catalog';
import { isClosedReservation } from '@/lib/booking-catalog';
import { formatProgramDate, programAvailability, programKind, seatFillPercent, isBookable } from '@/lib/program-display';
import { bookingKindOf, type BookingKind } from '@/lib/booking-progress';
import type { Package, Reservation } from '@/types';

export { bookingKindOf, type BookingKind };

export const BOOKING_KIND_META: Record<BookingKind, { label: string; plural: string; icon: LucideIcon }> = {
  umrah: { label: 'عمرة', plural: 'العمرة', icon: MoonStar },
  hajj: { label: 'حج', plural: 'الحج', icon: MoonStar },
  trip: { label: 'رحلة سياحية', plural: 'الرحلات السياحية', icon: Plane },
  hotel: { label: 'فندق', plural: 'حجوزات الفنادق', icon: BedDouble },
};

type Lists = { demands: Reservation[]; awaiting: Reservation[]; recent: Reservation[] };

type KindStats = { kind: BookingKind; fresh: number; deposit: number; confirmed: number; value: number; collected: number };

function money(n: number): string {
  return `${Math.round(Number(n) || 0).toLocaleString('ar-DZ')} دج`;
}

function statsOf(lists: Lists): KindStats[] {
  const blank = (kind: BookingKind): KindStats => ({ kind, fresh: 0, deposit: 0, confirmed: 0, value: 0, collected: 0 });
  const by = new Map<BookingKind, KindStats>((['umrah', 'hajj', 'trip', 'hotel'] as const).map((k) => [k, blank(k)]));
  const seen = new Set<string>();
  const add = (list: Reservation[], field: 'fresh' | 'deposit' | 'confirmed') => {
    for (const r of list) {
      if (seen.has(r.reservation_id) || isClosedReservation(String(r.status))) continue;
      seen.add(r.reservation_id);
      const s = by.get(bookingKindOf(r))!;
      s[field] += 1;
      if (field !== 'fresh') {
        s.value += Number(r.total_amount) || 0;
        s.collected += Number(r.paid_amount) || 0;
      }
    }
  };
  add(lists.demands, 'fresh');
  add(lists.awaiting, 'deposit');
  add(lists.recent, 'confirmed');
  // Hajj gets its own card only when it has bookings; Umrah, trips and hotels always show.
  return [...by.values()].filter((s) => s.kind !== 'hajj' || s.fresh + s.deposit + s.confirmed > 0);
}

/**
 * Bookings split by kind — Umrah, tourist trips, hotels — with what waits on whom
 * and the money involved, plus the tourist trips open for sale. Used on top of the
 * booking pipeline (pass its lists and onPick) and on the accountant overview
 * (no lists: it loads them itself; onPick opens the pipeline).
 */
export default function BookingKindsBoard({
  lists,
  active,
  onPick,
  role = 'agency',
}: {
  lists?: Lists;
  active?: BookingKind | 'all';
  onPick?: (kind: BookingKind) => void;
  /** Accountants see deposits first; the agency sees new requests first. */
  role?: 'agency' | 'accountant';
}) {
  const [own, setOwn] = useState<Lists | null>(null);
  const [trips, setTrips] = useState<Package[] | null>(null);

  useEffect(() => {
    if (lists) return;
    let off = false;
    fetch('/api/bookings/confirm', { headers: authHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (off) return;
        setOwn({
          demands: Array.isArray(d.demands) ? d.demands : [],
          awaiting: Array.isArray(d.awaitingDeposit) ? d.awaitingDeposit : [],
          recent: Array.isArray(d.recent) ? d.recent : [],
        });
      })
      .catch(() => !off && setOwn({ demands: [], awaiting: [], recent: [] }));
    return () => {
      off = true;
    };
  }, [lists]);

  useEffect(() => {
    let off = false;
    publicList<Package>('packages')
      .then((list) => {
        if (off) return;
        const open = (Array.isArray(list) ? list : [])
          .filter((p) => programKind(p) === 'tourism' && isBookable(programAvailability(p)))
          .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
        setTrips(open);
      })
      .catch(() => !off && setTrips([]));
    return () => {
      off = true;
    };
  }, []);

  const data = lists || own;
  const stats = useMemo(() => (data ? statsOf(data) : []), [data]);

  return (
    <section className="bkb" dir="rtl" aria-label="الحجوزات حسب النوع">
      <div className="bkb-cards">
        {data
          ? stats.map((s) => {
              const meta = BOOKING_KIND_META[s.kind];
              const Icon = meta.icon;
              const lead = role === 'accountant' ? s.deposit : s.fresh;
              const on = active === s.kind;
              return (
                <button
                  key={s.kind}
                  type="button"
                  className={`bkb-card is-${s.kind}${on ? ' is-on' : ''}${lead > 0 ? ' has-work' : ''}`}
                  onClick={() => onPick?.(s.kind)}
                  aria-pressed={onPick ? on : undefined}
                >
                  <span className="bkb-card-head">
                    <span className="bkb-ico"><Icon aria-hidden /></span>
                    <b>{meta.plural}</b>
                    {lead > 0 ? <span className="bkb-alert">{lead} {role === 'accountant' ? 'عربون' : 'جديد'}</span> : null}
                  </span>
                  <span className="bkb-stats">
                    <span><strong>{s.fresh}</strong><small>طلبات جديدة</small></span>
                    <span><strong>{s.deposit}</strong><small>بانتظار العربون</small></span>
                    <span><strong>{s.confirmed}</strong><small>مؤكدة</small></span>
                  </span>
                  <span className="bkb-money">
                    <span>القيمة <b>{money(s.value)}</b></span>
                    <span>المحصّل <b>{money(s.collected)}</b></span>
                  </span>
                  {s.value > 0 ? (
                    <span className="bkb-bar" aria-hidden><i style={{ width: `${Math.min(100, Math.round((s.collected / s.value) * 100))}%` }} /></span>
                  ) : null}
                </button>
              );
            })
          : [0, 1, 2].map((i) => <span key={i} className="bkb-card is-skeleton" aria-hidden />)}
      </div>

      <div className="bkb-trips">
        <div className="bkb-trips-head">
          <Plane aria-hidden />
          <b>الرحلات السياحية المفتوحة للحجز</b>
          <Link href="/packages?kind=tourism" className="bkb-trips-all">كل الرحلات <ArrowLeft aria-hidden /></Link>
        </div>
        {trips === null ? (
          <p className="bkb-muted">جاري التحميل…</p>
        ) : trips.length === 0 ? (
          <p className="bkb-muted">لا رحلة سياحية مفتوحة الآن — أضف رحلة من «البرامج» واختر نوعها «رحلة سياحية» لتظهر في الصفحة الرئيسية.</p>
        ) : (
          <ul className="bkb-trip-list">
            {trips.slice(0, 6).map((p) => {
              const fill = seatFillPercent(p);
              return (
                <li key={p.package_id}>
                  <Link href={`/packages/${encodeURIComponent(p.package_id)}`} className="bkb-trip">
                    <span className="bkb-trip-name">{p.name}</span>
                    <small>{formatProgramDate(p.start_date)}{p.capacity ? ` · ${Number(p.available) || 0} مقعد متبقٍ من ${p.capacity}` : ''}</small>
                    {p.capacity ? <span className="bkb-bar" aria-hidden><i style={{ width: `${fill}%` }} /></span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

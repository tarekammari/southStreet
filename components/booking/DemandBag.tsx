'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BedDouble, Calendar, ChevronDown, Loader2, MoonStar, Plane, ShoppingBag, type LucideIcon } from 'lucide-react';
import { Reservation, User } from '@/types';
import { isCurrentReservation, reservationStatusLabel } from '@/lib/booking-catalog';
import { BOOKING_KIND_LABEL, bookingDateLabel, bookingHref, bookingKindOf, bookingProgress, type BookingKind } from '@/lib/booking-progress';
import { toPortalRole } from '@/lib/roles';
import { authHeaders, getAuthToken } from '@/lib/api-client';

const KIND_ICON: Record<BookingKind, LucideIcon> = { umrah: MoonStar, hajj: MoonStar, trip: Plane, hotel: BedDouble };

function money(n: number): string {
  return `${(n || 0).toLocaleString('ar-DZ')} دج`;
}

function staffInboxHref(role: ReturnType<typeof toPortalRole>): string {
  if (role === 'admin' || role === 'manager') return '/admin';
  if (role === 'agent') return '/portal?tab=agent';
  if (role === 'accountant') return '/portal?tab=accountant';
  return '/portal';
}

function KindChip({ res }: { res: Reservation }) {
  const kind = bookingKindOf(res);
  const Icon = KIND_ICON[kind];
  return (
    <span className={`demand-bag-kind is-${kind}`}>
      <Icon aria-hidden /> {BOOKING_KIND_LABEL[kind]}
    </span>
  );
}

/** Four dots: sent → accepted → deposit → travel / stay, as on the booking pages. */
function MiniSteps({ res }: { res: Reservation }) {
  const p = bookingProgress(res);
  return (
    <div className={`demand-bag-steps${p.closed ? ' is-closed' : ''}`} aria-label={p.next}>
      <ol>
        {p.steps.map((label, i) => (
          <li key={label} className={p.closed ? '' : i <= p.done ? 'is-done' : i === p.done + 1 ? 'is-next' : ''} title={label} />
        ))}
      </ol>
      <small>{p.next}</small>
    </div>
  );
}

export default function DemandBag({
  user,
  isLight = true,
}: {
  user?: User | null;
  isLight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Reservation[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const portalRole = user ? toPortalRole(user.role, { email: user.email, roleName: user.roleName }) : null;
  const isPilgrim = portalRole === 'pilgrim';
  const isStaff = portalRole === 'admin' || portalRole === 'manager' || portalRole === 'agent' || portalRole === 'accountant';

  const load = useCallback(() => {
    if ((!isPilgrim && !isStaff) || !getAuthToken()) {
      setItems([]);
      return;
    }
    setLoading(true);
    const url = isStaff ? '/api/bookings/confirm' : '/api/bookings';
    fetch(url, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isStaff) {
          setItems((data?.pending || []) as Reservation[]);
          return;
        }
        // Umrah, trips and hotel stays together, nearest date first.
        const all = [...((data?.reservations || []) as Reservation[]), ...((data?.hotelBookings || []) as Reservation[])];
        setItems(
          all
            .filter((row) => isCurrentReservation(row))
            .sort((a, b) => String(a.hotel_stay?.check_in || a.program?.start_date || '').localeCompare(String(b.hotel_stay?.check_in || b.program?.start_date || '')))
        );
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isPilgrim, isStaff]);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  useEffect(() => {
    const onUpdate = () => load();
    window.addEventListener('southstreet:bookings-updated', onUpdate);
    window.addEventListener('focus', onUpdate);
    return () => {
      window.removeEventListener('southstreet:bookings-updated', onUpdate);
      window.removeEventListener('focus', onUpdate);
    };
  }, [load]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isPilgrim && !isStaff) return null;

  const count = items.length;
  const btnClass = isLight
    ? 'demand-bag-btn demand-bag-btn-light'
    : 'demand-bag-btn demand-bag-btn-dark';
  const inbox = staffInboxHref(portalRole || 'pilgrim');
  const title = isStaff ? 'طلبات الحجز' : 'حجوزاتي';
  const close = () => setOpen(false);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={btnClass}
        onClick={() => setOpen((v) => !v)}
        aria-label={`${title} (${count})`}
        title={isStaff ? 'طلبات العمرة والرحلات والفنادق' : 'حجوزاتي: عمرة، رحلات، فنادق'}
      >
        <ShoppingBag className="w-[18px] h-[18px]" />
        {count > 0 ? <span className="demand-bag-badge">{count > 9 ? '9+' : count}</span> : null}
      </button>

      {open && (
        <div className={`demand-bag-panel ${isLight ? 'demand-bag-panel-light' : 'demand-bag-panel-dark'}`}>
          <div className="demand-bag-head">
            <strong>{title}</strong>
            <span>{count} {isStaff ? 'بانتظار التأكيد' : count === 1 ? 'حجز' : 'حجوزات'}</span>
          </div>

          {loading && count === 0 ? (
            <p className="demand-bag-empty">
              <Loader2 className="w-4 h-4 animate-spin inline" /> جاري التحميل...
            </p>
          ) : count === 0 ? (
            <div className="demand-bag-empty">
              <p>{isStaff ? 'لا توجد طلبات معلّقة حالياً' : 'لا توجد حجوزات حالياً. اختر عمرة أو رحلة أو فندقاً، وتتابع حالة طلبك هنا خطوة بخطوة.'}</p>
              {!isStaff ? (
                <div className="demand-bag-empty-acts">
                  <Link href="/packages" onClick={close} className="demand-bag-cta">العمرة والرحلات</Link>
                  <Link href="/hotels" onClick={close} className="demand-bag-cta is-ghost">احجز فندقاً</Link>
                </div>
              ) : (
                <Link href={inbox} onClick={close} className="demand-bag-cta">
                  فتح صندوق الطلبات
                </Link>
              )}
            </div>
          ) : (
            <ul className="demand-bag-list">
              {items.map((res) => {
                const hotel = bookingKindOf(res) === 'hotel';
                return (
                  <li key={res.reservation_id} className="demand-bag-item">
                    <div className="demand-bag-item-top">
                      <span className="demand-bag-tags">
                        <KindChip res={res} />
                        <span className="demand-bag-status">{reservationStatusLabel(res.status)}</span>
                      </span>
                      <strong>{money(res.total_amount)}</strong>
                    </div>
                    <h4>{isStaff ? res.customer_name : res.hotel_stay?.hotel_name || res.package_name}</h4>
                    <p className="demand-bag-meta">
                      <Calendar className="w-3 h-3 inline opacity-60" />
                      {' '}
                      {isStaff ? res.package_name : bookingDateLabel(res)} · {res.reservation_number}
                    </p>
                    {!isStaff ? <MiniSteps res={res} /> : null}
                    <div className="demand-bag-actions">
                      {isStaff ? (
                        <Link href={inbox} onClick={close}>مراجعة الطلب</Link>
                      ) : (
                        <>
                          {!hotel && ['REQUESTED', 'PENDING'].includes(String(res.status).toUpperCase()) ? (
                            <Link href="/book" onClick={close}>تعديل</Link>
                          ) : null}
                          <Link href={bookingHref(res)} onClick={close}>تابع الحالة</Link>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {count > 0 ? (
            <Link
              href={isStaff ? inbox : '/portal?tab=program'}
              onClick={close}
              className="demand-bag-foot"
            >
              {isStaff ? 'عرض كل الطلبات' : 'كل حجوزاتي'}
              <ChevronDown className="w-3.5 h-3.5 rotate-90" />
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

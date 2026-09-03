'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Loader2, Calendar, ChevronDown } from 'lucide-react';
import { Reservation, User } from '@/types';
import { isActiveReservation, reservationStatusLabel } from '@/lib/booking-catalog';
import { toPortalRole } from '@/lib/roles';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function money(n: number): string {
  return `${(n || 0).toLocaleString('ar-DZ')} دج`;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric', year: 'numeric' });
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

  const isPilgrim = user && toPortalRole(user.role, { email: user.email, roleName: user.roleName }) === 'pilgrim';

  const load = useCallback(() => {
    if (!isPilgrim || !localStorage.getItem('south_street_token')) {
      setItems([]);
      return;
    }
    setLoading(true);
    fetch('/api/bookings', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = (data?.reservations || []) as Reservation[];
        setItems(list.filter((row) => isActiveReservation(row.status)));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isPilgrim]);

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

  if (!isPilgrim) return null;

  const count = items.length;
  const btnClass = isLight
    ? 'demand-bag-btn demand-bag-btn-light'
    : 'demand-bag-btn demand-bag-btn-dark';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={btnClass}
        onClick={() => setOpen((v) => !v)}
        aria-label={`طلباتي (${count})`}
        title="طلبات العمرة"
      >
        <ShoppingBag className="w-[18px] h-[18px]" />
        {count > 0 ? <span className="demand-bag-badge">{count > 9 ? '9+' : count}</span> : null}
      </button>

      {open && (
        <div className={`demand-bag-panel ${isLight ? 'demand-bag-panel-light' : 'demand-bag-panel-dark'}`}>
          <div className="demand-bag-head">
            <strong>طلباتي</strong>
            <span>{count} برنامج</span>
          </div>

          {loading ? (
            <p className="demand-bag-empty">
              <Loader2 className="w-4 h-4 animate-spin inline" /> جاري التحميل...
            </p>
          ) : count === 0 ? (
            <div className="demand-bag-empty">
              <p>لا توجد طلبات عمرة حالياً</p>
              <Link href="/book" onClick={() => setOpen(false)} className="demand-bag-cta">
                ابدأ حجز برنامج
              </Link>
            </div>
          ) : (
            <ul className="demand-bag-list">
              {items.map((res) => (
                <li key={res.reservation_id} className="demand-bag-item">
                  <div className="demand-bag-item-top">
                    <span className="demand-bag-status">{reservationStatusLabel(res.status)}</span>
                    <strong>{money(res.total_amount)}</strong>
                  </div>
                  <h4>{res.package_name}</h4>
                  <p className="demand-bag-meta">
                    <Calendar className="w-3 h-3 inline opacity-60" />
                    {' '}
                    {formatDate(res.program?.start_date)} · {res.reservation_number}
                  </p>
                  <div className="demand-bag-actions">
                    <Link href="/book" onClick={() => setOpen(false)}>إدارة</Link>
                    <Link href="/portal?tab=reservations" onClick={() => setOpen(false)}>التفاصيل</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {count > 0 ? (
            <Link href="/portal?tab=reservations" onClick={() => setOpen(false)} className="demand-bag-foot">
              عرض كل الطلبات
              <ChevronDown className="w-3.5 h-3.5 rotate-90" />
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );

}

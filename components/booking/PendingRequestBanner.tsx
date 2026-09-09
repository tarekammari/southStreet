'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Reservation, User } from '@/types';
import { isActiveReservation, isAgencyConfirmed } from '@/lib/booking-catalog';
import { toPortalRole } from '@/lib/roles';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isPendingConfirmation(reservation: Reservation | null): reservation is Reservation {
  if (!reservation) return false;
  return isActiveReservation(reservation.status) && !isAgencyConfirmed(reservation.status);
}

export function usePendingReservation(user?: User | null) {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pilgrim = user && toPortalRole(user.role, { email: user.email, roleName: user.roleName }) === 'pilgrim';
    const token = localStorage.getItem('south_street_token');
    if (!pilgrim || !token) {
      setReservation(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch('/api/bookings', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const active = data?.activeReservation
          || (Array.isArray(data?.reservations)
            ? data.reservations.find((row: Reservation) => isPendingConfirmation(row))
            : null);
        setReservation(isPendingConfirmation(active) ? active : null);
      })
      .catch(() => {
        if (!cancelled) setReservation(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { reservation, loading, pending: isPendingConfirmation(reservation) };
}

export function PendingRequestStrip({
  reservation,
  home = false,
}: {
  reservation: Reservation;
  home?: boolean;
}) {
  return (
    <motion.div
      className={`request-status${home ? ' is-home' : ' is-panel'}`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-live="polite"
    >
      <span className="request-status-badge">
        <span className="request-status-dot" aria-hidden />
        قيد المراجعة
      </span>
      <span className="request-status-copy">
        <strong title={reservation.package_name}>{reservation.package_name}</strong>
        {reservation.reservation_number ? (
          <em>{reservation.reservation_number}</em>
        ) : null}
      </span>
      <Link href="/book" className="request-status-cta">
        عرض الطلب
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
      </Link>
    </motion.div>
  );
}

export default function PendingRequestBanner({
  user,
  variant = 'home',
}: {
  user?: User | null;
  variant?: 'home' | 'inline';
}) {
  const { reservation, loading, pending } = usePendingReservation(user);

  if (loading || !pending || !reservation) return null;

  const strip = <PendingRequestStrip reservation={reservation} home={variant === 'home'} />;

  if (variant === 'home') {
    return (
      <div className="request-pending-shell">
        <div className="request-pending-wrap">{strip}</div>
      </div>
    );
  }

  return strip;
}

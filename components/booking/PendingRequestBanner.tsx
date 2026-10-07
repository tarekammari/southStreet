'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Reservation, User } from '@/types';
import {
  isActiveReservation,
  isAgencyConfirmed,
  isAwaitingDepositConfirmation,
} from '@/lib/booking-catalog';
import { toPortalRole } from '@/lib/roles';
import UmrahCountdown from '@/components/booking/UmrahCountdown';
import { authHeaders, getAuthToken, apiFetch, jsonAuthHeaders } from '@/lib/api-client';


function isPendingConfirmation(reservation: Reservation | null): reservation is Reservation {
  if (!reservation) return false;
  if (isAwaitingDepositConfirmation(reservation.status, reservation.payment_status, reservation.paid_amount)) {
    return false;
  }
  return isActiveReservation(reservation.status) && !isAgencyConfirmed(reservation.status);
}

function isAwaitingDeposit(reservation: Reservation | null): reservation is Reservation {
  if (!reservation) return false;
  return isAwaitingDepositConfirmation(
    reservation.status,
    reservation.payment_status,
    reservation.paid_amount
  );
}

export function useActiveTrip(user?: User | null) {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pilgrim = user && toPortalRole(user.role, { email: user.email, roleName: user.roleName }) === 'pilgrim';
    const token = getAuthToken();
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
        const list: Reservation[] = Array.isArray(data?.reservations) ? data.reservations : [];
        const active = data?.activeReservation
          || list.find((row) => isActiveReservation(row.status))
          || null;
        setReservation(active);
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

  const awaitingDeposit = isAwaitingDeposit(reservation);
  return {
    reservation,
    loading,
    pending: isPendingConfirmation(reservation),
    awaitingDeposit,
    confirmed: Boolean(
      reservation
      && isAgencyConfirmed(reservation.status)
      && !awaitingDeposit
    ),
  };
}

export function usePendingReservation(user?: User | null) {
  const trip = useActiveTrip(user);
  return {
    reservation: trip.pending ? trip.reservation : null,
    loading: trip.loading,
    pending: trip.pending,
  };
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

export function AwaitingDepositStrip({
  reservation,
  home = false,
}: {
  reservation: Reservation;
  home?: boolean;
}) {
  return (
    <motion.div
      className={`request-status is-deposit${home ? ' is-home' : ' is-panel'}`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-live="polite"
    >
      <span className="request-status-badge is-warn">
        <span className="request-status-dot" aria-hidden />
        بانتظار العربون
      </span>
      <span className="request-status-copy">
        <strong title={reservation.package_name}>{reservation.package_name}</strong>
        <em>ملاحظة: الدفعة الأولى غير مسجّلة — التأكيد النهائي عند المحاسب</em>
      </span>
      <Link href="/book" className="request-status-cta">
        عرض الطلب
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
      </Link>
    </motion.div>
  );
}

export function ConfirmedTripStrip({
  reservation,
  home = false,
}: {
  reservation: Reservation;
  home?: boolean;
}) {
  const start = reservation.program?.start_date;
  return (
    <motion.div
      className={`home-trip-chip${home ? ' is-home' : ' is-panel'}`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      role="status"
    >
      <div className="home-trip-chip-copy">
        <span className="home-trip-chip-label">باقي على عمرتك</span>
        <UmrahCountdown startDate={start} variant="quiet" />
        <em className="home-trip-chip-pkg" title={reservation.package_name}>
          {reservation.package_name}
        </em>
      </div>
      <Link href="/portal?tab=program" className="home-trip-chip-cta">
        رحلتي
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
  const { reservation, loading, pending, confirmed, awaitingDeposit } = useActiveTrip(user);

  if (loading || !reservation) return null;

  const strip = pending
    ? <PendingRequestStrip reservation={reservation} home={variant === 'home'} />
    : awaitingDeposit
      ? <AwaitingDepositStrip reservation={reservation} home={variant === 'home'} />
      : confirmed
        ? <ConfirmedTripStrip reservation={reservation} home={variant === 'home'} />
        : null;

  if (!strip) return null;

  if (variant === 'home') {
    return (
      <div className="request-pending-shell">
        <div className="request-pending-wrap">{strip}</div>
      </div>
    );
  }

  return strip;
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, X } from 'lucide-react';
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

const DISMISSED_KEY = 'ss_dismissed_refusals';
/** A refusal stays visible for this long unless the pilgrim dismisses it. */
const REFUSAL_VISIBLE_MS = 30 * 24 * 60 * 60 * 1000;

function dismissedRefusals(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

export function dismissRefusal(reservationId: string) {
  try {
    const next = Array.from(new Set([...dismissedRefusals(), reservationId])).slice(-20);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    /* private mode: it simply shows again next visit */
  }
}

/** The latest refused request the pilgrim has not dismissed yet (only when nothing is active). */
export function latestRefusal(list: Reservation[]): Reservation | null {
  const hidden = new Set(dismissedRefusals());
  const refused = list
    .filter((row) => String(row.status || '').toUpperCase() === 'REJECTED' && !hidden.has(row.reservation_id))
    .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));
  const latest = refused[0];
  if (!latest) return null;
  const at = new Date(latest.updated_at || latest.created_at || 0).getTime();
  return Number.isFinite(at) && Date.now() - at < REFUSAL_VISIBLE_MS ? latest : null;
}

export function useActiveTrip(user?: User | null) {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [refusal, setRefusal] = useState<Reservation | null>(null);
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
        setRefusal(active ? null : latestRefusal(list));
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
    refusal,
    dismissRefusal: () => {
      if (refusal) dismissRefusal(refusal.reservation_id);
      setRefusal(null);
    },
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

/** The agency refused (or cancelled) the request: say so, show why, offer the next step. */
export function RefusedRequestStrip({
  reservation,
  home = false,
  onDismiss,
}: {
  reservation: Reservation;
  home?: boolean;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      className={`request-status is-refused${home ? ' is-home' : ' is-panel'}`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-live="polite"
    >
      <span className="request-status-badge is-bad">
        <span className="request-status-dot" aria-hidden />
        تعذّر إتمام طلبك
      </span>
      <span className="request-status-copy">
        <strong title={reservation.package_name}>{reservation.package_name}</strong>
        <em>{reservation.agency_note ? `السبب: ${reservation.agency_note}` : 'تواصل معنا لمعرفة التفاصيل.'}</em>
      </span>
      <Link href="/packages" className="request-status-cta">
        اختر برنامجاً آخر
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
      </Link>
      <Link href="/portal?tab=chat" className="request-status-cta is-ghost" aria-label="مراسلة الوكالة">
        <MessageCircle className="w-3.5 h-3.5" aria-hidden />
      </Link>
      <button type="button" className="request-status-close" onClick={onDismiss} aria-label="إخفاء">
        <X className="w-3.5 h-3.5" />
      </button>
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
  const { reservation, refusal, dismissRefusal: hideRefusal, loading, pending, confirmed, awaitingDeposit } = useActiveTrip(user);

  if (loading) return null;
  if (!reservation && refusal) {
    const refused = <RefusedRequestStrip reservation={refusal} home={variant === 'home'} onDismiss={hideRefusal} />;
    return variant === 'home' ? (
      <div className="request-pending-shell">
        <div className="request-pending-wrap">{refused}</div>
      </div>
    ) : refused;
  }
  if (!reservation) return null;

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

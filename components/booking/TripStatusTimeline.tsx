'use client';

import { ReservationStatus } from '@/types';

type StepId = 'requested' | 'awaiting' | 'confirmed' | 'payment' | 'documents' | 'done';

const STEPS: { id: StepId; label: string }[] = [
  { id: 'requested', label: 'طلب' },
  { id: 'awaiting', label: 'بانتظار التأكيد' },
  { id: 'confirmed', label: 'مؤكد' },
  { id: 'payment', label: 'الدفع' },
  { id: 'documents', label: 'الوثائق' },
  { id: 'done', label: 'تم' },
];

function mapStatus(status?: string | null, paymentStatus?: string | null): {
  active: StepId;
  terminal?: 'cancelled' | 'rejected';
} {
  const s = String(status || '').toUpperCase();
  const pay = String(paymentStatus || '').toUpperCase();

  if (s === 'CANCELLED') return { active: 'done', terminal: 'cancelled' };
  if (s === 'REJECTED') return { active: 'awaiting', terminal: 'rejected' };
  if (s === 'COMPLETED') return { active: 'done' };
  if (s === 'READY_FOR_TRAVEL') return { active: 'documents' };
  if (s === 'DOCUMENTS_PENDING') return { active: 'documents' };
  if (s === 'PAID' || pay === 'PAID') return { active: 'payment' };
  if (s === 'PARTIALLY_PAID' || pay === 'PARTIALLY_PAID') {
    return { active: 'payment' };
  }
  // Accepted by agency, deposit not yet booked by accountant.
  if (s === 'PAYMENT_PENDING' || (s === 'CONFIRMED' && (pay === 'UNPAID' || pay === 'PENDING' || !pay))) {
    return { active: 'payment' };
  }
  if (s === 'CONFIRMED') return { active: 'confirmed' };
  if (s === 'REQUESTED' || s === 'PENDING') return { active: 'awaiting' };
  return { active: 'requested' };
}

function stepIndex(id: StepId): number {
  return STEPS.findIndex((s) => s.id === id);
}

export default function TripStatusTimeline({
  status,
  paymentStatus,
  compact,
}: {
  status?: ReservationStatus | string | null;
  paymentStatus?: string | null;
  compact?: boolean;
}) {
  const mapped = mapStatus(status, paymentStatus);
  const current = stepIndex(mapped.active);
  const cancelled = mapped.terminal === 'cancelled';
  const rejected = mapped.terminal === 'rejected';

  return (
    <div className={`trip-status-tl${compact ? ' is-compact' : ''}${cancelled ? ' is-cancelled' : ''}${rejected ? ' is-rejected' : ''}`} dir="rtl" role="list" aria-label="مسار رحلتك">
      <p className="trip-status-tl-title">رحلتك</p>
      <ol className="trip-status-tl-list">
        {STEPS.map((step, index) => {
          let state: 'done' | 'current' | 'todo' = 'todo';
          if (cancelled || rejected) {
            state = index <= current ? 'done' : 'todo';
            if (step.id === mapped.active) state = 'current';
          } else if (index < current) state = 'done';
          else if (index === current) state = 'current';

          return (
            <li key={step.id} className={`trip-status-tl-step is-${state}`} role="listitem">
              <i aria-hidden />
              <span>{step.id === 'done' && cancelled ? 'ملغى' : step.id === 'awaiting' && rejected ? 'مرفوض' : step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

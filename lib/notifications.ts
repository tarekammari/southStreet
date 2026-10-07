/**
 * Notification stubs for pilgrim UX (email/push later).
 * Safe no-ops with optional audit log — never throws.
 */

import { dbLogAudit } from '@/lib/db';

function audit(actor: string, action: string, detail: string) {
  try {
    dbLogAudit(actor || 'system', 'SYSTEM', action, detail);
  } catch {
    /* audit optional */
  }
}

export function notifySignup(input: {
  userId?: string;
  name?: string;
  email?: string;
  status?: string;
}): void {
  audit(
    input.name || input.email || 'pilgrim',
    'notifySignup',
    'user=' + (input.userId || '?') + ' status=' + (input.status || '') + ' email=' + (input.email || ''),
  );
}

export function notifyBookingSubmitted(input: {
  reservationId?: string;
  reservationNumber?: string;
  customerName?: string;
  packageName?: string;
}): void {
  audit(
    input.customerName || 'pilgrim',
    'notifyBookingSubmitted',
    (input.reservationNumber || input.reservationId || '?') + ' — ' + (input.packageName || ''),
  );
}

export function notifyBookingConfirmed(input: {
  reservationId?: string;
  reservationNumber?: string;
  customerName?: string;
  packageName?: string;
}): void {
  audit(
    input.customerName || 'agency',
    'notifyBookingConfirmed',
    (input.reservationNumber || input.reservationId || '?') + ' — ' + (input.packageName || ''),
  );
}

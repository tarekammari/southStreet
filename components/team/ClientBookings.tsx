'use client';

import { useState } from 'react';
import { BedDouble, CalendarDays, Check, Loader2, MoonStar, Plane, Wallet, X, type LucideIcon } from 'lucide-react';
import { authHeaders } from '@/lib/api-client';
import type { ClientBooking } from './teamModel';

const KIND: Record<ClientBooking['kind'], { label: string; icon: LucideIcon }> = {
  umrah: { label: 'عمرة', icon: MoonStar },
  hajj: { label: 'حج', icon: MoonStar },
  trip: { label: 'رحلة سياحية', icon: Plane },
  hotel: { label: 'فندق', icon: BedDouble },
};

const money = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('ar-DZ')} دج`;
const day = (v?: string) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

/** Where the booking stands, in the agency's steps: request → accepted (deposit at the accountant) → confirmed. */
function stage(b: ClientBooking): { step: number; next: string } {
  const s = b.status.toUpperCase();
  if (s === 'REQUESTED' || s === 'PENDING') return { step: 0, next: 'طلب جديد — بانتظار قبولك' };
  if (s === 'PAYMENT_PENDING' || (s === 'CONFIRMED' && b.paid <= 0)) return { step: 1, next: `مقبول — بانتظار العربون ${money(b.deposit)} عند المحاسب` };
  return { step: 2, next: b.paid >= b.total ? 'مؤكد ومدفوع بالكامل' : `مؤكد — المدفوع ${money(b.paid)} من ${money(b.total)}` };
}

/**
 * The client's current bookings of every kind in the team drawer. A Super Admin
 * or Admin accepts or refuses a new request here (same rules as the bookings
 * pipeline); once accepted it waits for the deposit at the accountant.
 */
export default function ClientBookings({
  bookings,
  canDecide,
  onChanged,
  onToast,
}: {
  bookings: ClientBooking[];
  canDecide: boolean;
  onChanged: () => void;
  onToast: (text: string, tone?: 'ok' | 'error') => void;
}) {
  const [busy, setBusy] = useState('');
  const [refusing, setRefusing] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const decide = async (b: ClientBooking, action: 'confirm' | 'reject') => {
    if (action === 'reject' && reason.trim().length < 3) {
      onToast('اكتب سبب الرفض — يصل إلى العميل', 'error');
      return;
    }
    setBusy(b.id);
    try {
      const res = await fetch('/api/bookings/confirm', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: b.id, action, note: action === 'reject' ? reason.trim() : '' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'تعذّر تنفيذ الإجراء');
      onToast(action === 'confirm' ? `قُبل ${b.reference} — بانتظار العربون عند المحاسب` : `رُفض ${b.reference} وأُبلغ العميل`);
      setRefusing(null);
      setReason('');
      window.dispatchEvent(new Event('southstreet:bookings-updated'));
      onChanged();
    } catch (e: any) {
      onToast(e?.message || 'تعذّر تنفيذ الإجراء', 'error');
    } finally {
      setBusy('');
    }
  };

  if (!bookings.length) {
    return (
      <div className="tm-bookings is-empty">
        <small>الحجوزات</small>
        <strong>لا يوجد حجز حالي — عمرة أو رحلة أو فندق</strong>
      </div>
    );
  }

  return (
    <div className="tm-bookings">
      <small>الحجوزات الحالية ({bookings.length})</small>
      {bookings.map((b) => {
        const { label, icon: Icon } = KIND[b.kind];
        const st = stage(b);
        return (
          <article key={b.id} className={`tm-booking is-${b.kind}`}>
            <header>
              <span className="tm-booking-kind"><Icon aria-hidden /> {label}</span>
              <span className="tm-booking-status">{b.statusLabel}</span>
              <b dir="ltr">{b.reference}</b>
            </header>
            <strong>{b.name}</strong>
            <span className="tm-booking-meta">
              {b.startDate ? <span><CalendarDays aria-hidden /> {day(b.startDate)}{b.endDate ? ` ← ${day(b.endDate)}` : ''}</span> : null}
              <span><Wallet aria-hidden /> {money(b.total)}</span>
            </span>
            <ol className="tm-booking-steps" aria-label={st.next}>
              {['الطلب', 'قبول الوكالة', 'العربون — مؤكد'].map((s, i) => (
                <li key={s} className={i < st.step ? 'is-done' : i === st.step ? 'is-now' : ''}>{s}</li>
              ))}
            </ol>
            <p className="tm-booking-next">{st.next}</p>
            {st.step === 0 && canDecide ? (
              refusing === b.id ? (
                <div className="tm-booking-refuse">
                  <textarea rows={2} maxLength={500} placeholder="سبب الرفض (يصل إلى العميل)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="tm-booking-acts">
                    <button type="button" className="is-bad" disabled={busy === b.id} onClick={() => void decide(b, 'reject')}>
                      {busy === b.id ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />} تأكيد الرفض
                    </button>
                    <button type="button" onClick={() => { setRefusing(null); setReason(''); }}>تراجع</button>
                  </div>
                </div>
              ) : (
                <div className="tm-booking-acts">
                  <button type="button" className="is-ok" disabled={busy === b.id} onClick={() => void decide(b, 'confirm')}>
                    {busy === b.id ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} قبول الطلب
                  </button>
                  <button type="button" className="is-bad" disabled={busy === b.id} onClick={() => setRefusing(b.id)}>
                    <X aria-hidden /> رفض
                  </button>
                </div>
              )
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

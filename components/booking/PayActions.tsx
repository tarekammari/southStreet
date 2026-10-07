'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, CreditCard } from 'lucide-react';
import { DEPOSIT_PERCENT } from '@/lib/booking-catalog';
import { Reservation } from '@/types';

function money(n: number): string {
  return `${(n || 0).toLocaleString('ar-DZ')} دج`;
}

export default function PayActions({
  reservation,
  className = '',
}: {
  reservation: Reservation;
  className?: string;
}) {
  const [cardEnabled, setCardEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCardEnabled(Boolean(d.onlineCardPayEnabled));
      })
      .catch(() => {
        if (!cancelled) setCardEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const invoice = reservation.invoice;
  const total = Number(invoice?.total ?? reservation.total_amount) || 0;
  const depositPercent = Number(invoice?.depositPercent ?? Math.round(DEPOSIT_PERCENT * 100)) || Math.round(DEPOSIT_PERCENT * 100);
  const depositAmount = Number(invoice?.depositAmount ?? Math.round(total * DEPOSIT_PERCENT)) || 0;
  const paid = Number(reservation.paid_amount) || 0;
  const remaining = Number(invoice?.remainingAmount ?? Math.max(0, total - Math.max(paid, depositAmount))) || 0;

  return (
    <div className={`pay-actions ${className}`.trim()} dir="rtl">
      <div className="pay-actions-summary">
        <div>
          <span>المجموع</span>
          <strong>{money(total)}</strong>
        </div>
        <div>
          <span>عربون التأكيد ({depositPercent}٪)</span>
          <strong>{money(depositAmount)}</strong>
        </div>
        <div>
          <span>المدفوع</span>
          <strong>{money(paid)}</strong>
        </div>
        <div>
          <span>المتبقي</span>
          <strong>{money(Math.max(0, remaining))}</strong>
        </div>
      </div>

      <div className="pay-actions-btns">
        <Link href="/portal?tab=program" className="book-btn book-btn-primary no-underline pay-actions-primary">
          <Building2 className="w-4 h-4" aria-hidden />
          الدفع في الوكالة / سند قبض
        </Link>
        <button
          type="button"
          className="book-btn book-btn-ghost pay-actions-card"
          disabled={!cardEnabled}
          title={cardEnabled ? 'الدفع بالبطاقة' : 'قريباً / Coming soon'}
        >
          <CreditCard className="w-4 h-4" aria-hidden />
          الدفع بالبطاقة (Stripe / CIB)
          {!cardEnabled ? <em className="pay-actions-soon">قريباً / Coming soon</em> : null}
        </button>
      </div>
      <p className="pay-actions-hint">
        المسار: قبول الوكالة للطلب → تحصيل العربون عند المحاسب (سند قبض) → التأكيد النهائي.
        القبول وحده لا يُسجّل أي مبلغ مدفوع. البطاقة الإلكترونية غير مفعّلة بعد.
      </p>
    </div>
  );
}

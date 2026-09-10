'use client';

import { useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { BookingDocType } from '@/lib/booking-documents';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function BookingPrintButton({
  type,
  step,
  label,
  draft,
  reservationId,
  receiptId,
  className = 'book-btn book-btn-ghost',
  disabled,
}: {
  type: BookingDocType;
  step?: number;
  label?: string;
  draft?: Record<string, unknown>;
  reservationId?: string;
  receiptId?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const print = async () => {
    if (reservationId && !localStorage.getItem('south_street_token')) {
      setError('يلزم تسجيل الدخول لطباعة الطلب');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bookings/document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ type, step, draft, reservationId, receiptId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذّر إصدار الوثيقة');
        return;
      }
      if (data.printUrl) {
        window.open(data.printUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<BookingDocType, string> = {
    quote: 'معاينة عرض السعر',
    request: 'معاينة طلب الحجز',
    invoice: 'معاينة الفاتورة',
    receipt: 'معاينة سند الدفع',
    confirmation: 'معاينة تأكيد الوكالة',
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={className} onClick={print} disabled={disabled || loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
        {label || titles[type]}
      </button>
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </span>
  );
}

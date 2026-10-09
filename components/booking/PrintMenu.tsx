'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileCheck2, FileText, Loader2, Printer, ReceiptText } from 'lucide-react';
import { authHeaders } from '@/lib/api-client';
import { docLabel, printableDocs, type ReservationDoc } from '@/lib/booking-print-rules';

/**
 * Opens a booking document in a new tab. The tab is opened on the click itself
 * (before the server answers) so pop-up blockers let it through.
 */
export async function openBookingDocument(body: {
  type: string;
  reservationId?: string;
  receiptId?: string;
  step?: number;
  draft?: Record<string, unknown>;
}): Promise<string | null> {
  const tab = window.open('', '_blank');
  if (tab) {
    tab.opener = null;
    tab.document.title = 'جاري تجهيز الوثيقة…';
    tab.document.body.innerHTML = '<p style="font-family:Tahoma,sans-serif;text-align:center;margin-top:20vh;color:#64748b" dir="rtl">جاري تجهيز الوثيقة…</p>';
  }
  try {
    const res = await fetch('/api/bookings/document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.printUrl) {
      tab?.close();
      return data.error || 'تعذّر إصدار الوثيقة';
    }
    if (tab) tab.location.href = data.printUrl;
    else window.location.href = data.printUrl;
    return null;
  } catch {
    tab?.close();
    return 'تعذّر الاتصال بالخادم';
  }
}

const ICONS: Record<ReservationDoc, typeof FileText> = {
  confirmation: FileCheck2,
  invoice: ReceiptText,
  request: FileText,
};

/** One "طباعة" control showing only the documents that fit the request's stage. */
export default function PrintMenu({
  reservationId,
  status,
  className = 'pipe-btn',
}: {
  reservationId: string;
  status?: string | null;
  className?: string;
}) {
  const docs = printableDocs(status);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ReservationDoc | null>(null);
  const [error, setError] = useState('');
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (docs.length === 0) return null;

  const print = async (type: ReservationDoc) => {
    setOpen(false);
    setBusy(type);
    setError('');
    const problem = await openBookingDocument({ type, reservationId });
    if (problem) setError(problem);
    setBusy(null);
  };

  if (docs.length === 1) {
    const only = docs[0];
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <button type="button" className={className} onClick={() => print(only)} disabled={Boolean(busy)}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
          طباعة {docLabel(only, status).label}
        </button>
        {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
      </span>
    );
  }

  return (
    <span ref={ref} className="print-menu">
      <button type="button" className={className} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} disabled={Boolean(busy)}>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
        طباعة
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>
      {open ? (
        <span className="print-menu-list" role="menu">
          {docs.map((type) => {
            const Icon = ICONS[type];
            const { label, hint } = docLabel(type, status);
            return (
              <button key={type} type="button" role="menuitem" className="print-menu-item" onClick={() => print(type)}>
                <Icon className="w-4 h-4" />
                <span>
                  <strong>{label}</strong>
                  <em>{hint}</em>
                </span>
              </button>
            );
          })}
        </span>
      ) : null}
      {error ? <span className="block text-[11px] text-red-600 mt-1">{error}</span> : null}
    </span>
  );
}

'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2, Printer } from 'lucide-react';
import './print-preview.css';

function PrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('t') || '';
  const autoPrint = searchParams.get('print') === '1';
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [html, setHtml] = useState('');
  const [meta, setMeta] = useState({ ref: '', type: '' });
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const handlePrint = useCallback(() => {
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      return;
    }
    window.print();
  }, []);

  useEffect(() => {
    if (!token) {
      setError('رمز الوثيقة غير موجود');
      return;
    }
    fetch(`/api/bookings/document?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'تعذّر تحميل الوثيقة');
        }
        const ref = res.headers.get('X-Doc-Ref') || '';
        const type = res.headers.get('X-Doc-Type') || '';
        setMeta({ ref, type });
        return res.text();
      })
      .then((content) => {
        setHtml(content);
        setReady(true);
      })
      .catch((err) => setError(err.message || 'تعذّر تحميل الوثيقة'));
  }, [token]);

  useEffect(() => {
    if (!ready || !autoPrint) return;
    const t = window.setTimeout(() => handlePrint(), 500);
    return () => window.clearTimeout(t);
  }, [ready, autoPrint, handlePrint]);

  if (error) {
    return <div className="print-error" dir="rtl">{error}</div>;
  }

  if (!html) {
    return (
      <div className="print-loading" dir="rtl">
        <Loader2 className="w-5 h-5 animate-spin" />
        جاري تحميل الوثيقة الآمنة...
      </div>
    );
  }

  return (
    <div className="print-viewer" dir="rtl">
      <header className="print-toolbar no-print">
        <button type="button" className="print-toolbar-btn" onClick={() => router.back()}>
          <ArrowRight className="w-4 h-4" />
          رجوع
        </button>
        <div className="print-toolbar-title">
          معاينة الوثيقة قبل الطباعة
          {meta.ref ? (
            <span className="print-toolbar-sub">
              {meta.type ? `${meta.type} · ` : ''}{meta.ref}
            </span>
          ) : null}
        </div>
        <button type="button" className="print-toolbar-btn print-toolbar-btn-primary" onClick={handlePrint}>
          <Printer className="w-4 h-4" />
          طباعة / حفظ PDF
        </button>
      </header>

      <main className="print-stage">
        <div>
          <div className="print-sheet-wrap">
            <iframe
              ref={iframeRef}
              title="معاينة الوثيقة"
              srcDoc={html}
              className="print-sheet-frame"
              onLoad={(e) => {
                const doc = e.currentTarget.contentDocument;
                if (!doc) return;
                const h = doc.documentElement.scrollHeight || 1123;
                e.currentTarget.style.height = `${Math.max(1123, h)}px`;
              }}
            />
          </div>
          <p className="print-hint no-print">
            للحفظ كـ PDF: اضغط «طباعة / حفظ PDF» ثم اختر «Save as PDF» أو «Microsoft Print to PDF» — الاتجاه: عمودي (Portrait)
          </p>
        </div>
      </main>
    </div>
  );
}

export default function BookingPrintPage() {
  return (
    <Suspense fallback={<div className="print-loading">جاري التحميل...</div>}>
      <PrintContent />
    </Suspense>
  );
}

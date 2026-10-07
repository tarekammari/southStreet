'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DocumentPrintViewer from '@/components/print/DocumentPrintViewer';
import '@/app/book/print/print-preview.css';

function RecapPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from')?.slice(0, 10) || '';
  const to = searchParams.get('to')?.slice(0, 10) || '';
  const autoPrint = searchParams.get('print') === '1';

  const fetchUrl = useMemo(() => {
    const q = new URLSearchParams({ from, to });
    return `/api/finance/reports/recap/print?${q.toString()}`;
  }, [from, to]);

  if (!from || !to) {
    return (
      <div className="print-error" dir="rtl">
        حدّد فترة العرض من الملخص ثم اطبع من جديد.
      </div>
    );
  }

  return (
    <DocumentPrintViewer
      fetchUrl={fetchUrl}
      title="معاينة القوائم المالية"
      subtitle={`${from} → ${to}`}
      onBack={() => router.back()}
      autoPrint={autoPrint}
    />
  );
}

export default function RecapPrintPage() {
  return (
    <Suspense fallback={<div className="print-loading">جاري التحميل…</div>}>
      <RecapPrintContent />
    </Suspense>
  );
}

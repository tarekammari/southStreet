'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DocumentPrintViewer from '@/components/print/DocumentPrintViewer';
import '@/app/book/print/print-preview.css';

function TaxPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from')?.slice(0, 10) || '';
  const to = searchParams.get('to')?.slice(0, 10) || '';
  const autoPrint = searchParams.get('print') === '1';

  const fetchUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return `/api/finance/taxes/print?${q.toString()}`;
  }, [from, to]);

  return (
    <DocumentPrintViewer
      fetchUrl={fetchUrl}
      title="معاينة الضرائب والرسوم"
      subtitle={from && to ? `${from} → ${to}` : 'السنة الجارية'}
      onBack={() => router.back()}
      autoPrint={autoPrint}
    />
  );
}

export default function TaxPrintPage() {
  return (
    <Suspense fallback={<div className="print-loading">جاري التحميل…</div>}>
      <TaxPrintContent />
    </Suspense>
  );
}

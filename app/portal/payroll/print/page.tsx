'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DocumentPrintViewer from '@/components/print/DocumentPrintViewer';
import '@/app/book/print/print-preview.css';

function PayrollPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const staff = searchParams.get('staff')?.trim() || '';
  const autoPrint = searchParams.get('print') === '1';

  const fetchUrl = useMemo(() => {
    const q = new URLSearchParams(searchParams.toString());
    q.delete('print');
    return `/api/finance/salaries/print?${q.toString()}`;
  }, [searchParams]);

  return (
    <DocumentPrintViewer
      fetchUrl={fetchUrl}
      title={staff ? 'معاينة كشف الراتب' : 'معاينة الرواتب'}
      subtitle={staff ? 'موظف واحد' : 'الفترة المعروضة'}
      onBack={() => router.back()}
      autoPrint={autoPrint}
    />
  );
}

export default function PayrollPrintPage() {
  return (
    <Suspense fallback={<div className="print-loading">جاري التحميل…</div>}>
      <PayrollPrintContent />
    </Suspense>
  );
}

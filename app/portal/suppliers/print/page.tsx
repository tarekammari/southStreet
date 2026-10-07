'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DocumentPrintViewer from '@/components/print/DocumentPrintViewer';
import '@/app/book/print/print-preview.css';

function SupplierPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplier = searchParams.get('supplier')?.trim() || '';
  const lane = searchParams.get('lane')?.trim() || '';
  const from = searchParams.get('from')?.slice(0, 10) || '';
  const to = searchParams.get('to')?.slice(0, 10) || '';
  const autoPrint = searchParams.get('print') === '1';

  const fetchUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (supplier) q.set('supplier', supplier);
    if (lane) q.set('lane', lane);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return `/api/finance/suppliers/print?${q.toString()}`;
  }, [supplier, lane, from, to]);

  return (
    <DocumentPrintViewer
      fetchUrl={fetchUrl}
      title={supplier ? 'معاينة كشف المورد' : 'معاينة الموردين'}
      subtitle={
        from && to
          ? `${from} → ${to}`
          : supplier
            ? 'كشف حساب'
            : lane
              ? 'المجموعة المحددة'
              : 'كل الموردين'
      }
      onBack={() => router.back()}
      autoPrint={autoPrint}
    />
  );
}

export default function SupplierPrintPage() {
  return (
    <Suspense fallback={<div className="print-loading">جاري التحميل…</div>}>
      <SupplierPrintContent />
    </Suspense>
  );
}

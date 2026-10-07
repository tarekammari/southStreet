'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DocumentPrintViewer from '@/components/print/DocumentPrintViewer';
import '@/app/book/print/print-preview.css';

function TreasuryPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from')?.slice(0, 10) || '';
  const to = searchParams.get('to')?.slice(0, 10) || '';
  const mode = (searchParams.get('mode') || 'full').trim();
  const account = searchParams.get('account')?.trim() || '';
  const autoPrint = searchParams.get('print') === '1';

  const fetchUrl = useMemo(() => {
    const q = new URLSearchParams({ from, to, mode });
    if (account) q.set('account', account);
    return `/api/finance/treasury/print?${q.toString()}`;
  }, [from, to, mode, account]);

  const title =
    mode === 'account' ? 'معاينة كشف حساب الخزينة' : mode === 'recap' ? 'معاينة ملخص الخزينة' : 'معاينة تقرير الخزينة';
  const subtitle = from && to ? `${from} → ${to}` : undefined;

  if (!from || !to) {
    return (
      <div className="print-error" dir="rtl">
        حدّد فترة الحركات من شاشة الخزينة ثم اطبع من جديد.
      </div>
    );
  }

  return (
    <DocumentPrintViewer
      fetchUrl={fetchUrl}
      title={title}
      subtitle={subtitle}
      onBack={() => router.back()}
      autoPrint={autoPrint}
    />
  );
}

export default function TreasuryPrintPage() {
  return (
    <Suspense fallback={<div className="print-loading">جاري التحميل…</div>}>
      <TreasuryPrintContent />
    </Suspense>
  );
}

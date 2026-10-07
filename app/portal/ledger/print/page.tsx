'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DocumentPrintViewer from '@/components/print/DocumentPrintViewer';
import '@/app/book/print/print-preview.css';

function LedgerPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('print') === '1';
  const from = searchParams.get('from')?.slice(0, 10) || '';
  const to = searchParams.get('to')?.slice(0, 10) || '';

  const fetchUrl = useMemo(() => {
    const q = new URLSearchParams(searchParams.toString());
    q.delete('print');
    return `/api/finance/ledger/print?${q.toString()}`;
  }, [searchParams]);

  const subtitle = from || to ? `${from || '…'} → ${to || '…'}` : 'كل الفترات';

  return (
    <DocumentPrintViewer
      fetchUrl={fetchUrl}
      title="معاينة اليومية العامة"
      subtitle={subtitle}
      onBack={() => router.back()}
      autoPrint={autoPrint}
    />
  );
}

export default function LedgerPrintPage() {
  return (
    <Suspense fallback={<div className="print-loading">جاري التحميل…</div>}>
      <LedgerPrintContent />
    </Suspense>
  );
}

'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DocumentPrintViewer from '@/components/print/DocumentPrintViewer';
import '@/app/book/print/print-preview.css';

function SupplierInvoicePrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplier = searchParams.get('supplier')?.trim() || '';
  const invoice = searchParams.get('invoice')?.trim() || '';
  const autoPrint = searchParams.get('print') === '1';

  const fetchUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (supplier) q.set('supplier', supplier);
    if (invoice) q.set('invoice', invoice);
    return `/api/finance/suppliers/invoice-print?${q.toString()}`;
  }, [supplier, invoice]);

  if (!supplier || !invoice) {
    return (
      <div className="print-error" dir="rtl">
        حدّد المورد والفاتورة للطباعة.
      </div>
    );
  }

  return (
    <DocumentPrintViewer
      fetchUrl={fetchUrl}
      title="نسخة الوكالة — فاتورة مورد"
      subtitle="Copie agence · ليست الفاتورة الأصلية للمورد"
      onBack={() => router.back()}
      autoPrint={autoPrint}
    />
  );
}

export default function SupplierInvoicePrintPage() {
  return (
    <Suspense fallback={<div className="print-error">جاري التحميل…</div>}>
      <SupplierInvoicePrintContent />
    </Suspense>
  );
}

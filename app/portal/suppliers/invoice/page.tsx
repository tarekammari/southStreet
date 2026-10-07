'use client';

import { Suspense } from 'react';
import SupplierInvoicePageClient from '@/components/accountant/SupplierInvoicePageClient';

export default function SupplierInvoicePage() {
  return (
    <Suspense fallback={<div className="acct-inv-page-loading">جاري التحميل…</div>}>
      <SupplierInvoicePageClient />
    </Suspense>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { getSupplier, listSupplierInvoices } from '@/lib/finance';
import { buildSupplierInvoiceAgencyCopyHtml } from '@/lib/supplier-invoice-print-document';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;

  const supplierId = req.nextUrl.searchParams.get('supplier')?.trim() || '';
  const invoiceId = req.nextUrl.searchParams.get('invoice')?.trim() || '';
  if (!supplierId || !invoiceId) {
    return NextResponse.json({ error: 'supplier و invoice مطلوبان' }, { status: 400 });
  }

  const supplier = getSupplier(supplierId) as {
    name_ar?: string;
    code?: string;
    contact?: string;
  } | null;
  if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 });

  const invoice = (listSupplierInvoices(supplierId) as Record<string, unknown>[]).find(
    (i) => String(i.id) === invoiceId
  );
  if (!invoice) return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 });

  const html = buildSupplierInvoiceAgencyCopyHtml({
    supplier: {
      name_ar: String(supplier.name_ar || supplierId),
      code: supplier.code ? String(supplier.code) : undefined,
      contact: supplier.contact ? String(supplier.contact) : undefined,
    },
    invoice: invoice as Parameters<typeof buildSupplierInvoiceAgencyCopyHtml>[0]['invoice'],
  });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

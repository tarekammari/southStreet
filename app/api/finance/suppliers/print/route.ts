import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceAccess } from '@/lib/finance-auth';
import { supplierLane, SUPPLIER_LANES } from '@/lib/finance-categories';
import {
  getSupplier,
  listSupplierInvoices,
  listSupplierPayments,
  listSuppliers,
  supplierStatement,
  supplierStatusList,
} from '@/lib/finance';
import { buildSupplierBookHtml, buildSupplierCardHtml } from '@/lib/supplier-print-document';

export const dynamic = 'force-dynamic';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const defaultFrom = () => isoDay(new Date(new Date().getFullYear(), 0, 1));
const defaultTo = () => isoDay(new Date());

export async function GET(req: NextRequest) {
  const gate = requireFinanceAccess(req);
  if ('error' in gate) return gate.error;

  const { searchParams } = new URL(req.url);
  const supplierId = searchParams.get('supplier')?.trim() || '';
  const lane = searchParams.get('lane')?.trim() || '';
  const from = searchParams.get('from')?.slice(0, 10) || defaultFrom();
  const to = searchParams.get('to')?.slice(0, 10) || defaultTo();

  if (supplierId) {
    const supplier = getSupplier(supplierId) as {
      id?: string;
      name_ar?: string;
      code?: string;
      category?: string | null;
      scf_code?: string | null;
      contact?: string | null;
      payment_terms_days?: number;
    } | null;
    if (!supplier?.id) return NextResponse.json({ error: 'supplier not found' }, { status: 404 });
    const invoices = listSupplierInvoices(supplierId) as {
      id: string;
      invoice_no?: string;
      invoice_date?: string;
      due_date?: string;
      amount?: number;
      amount_ht?: number | null;
      discount?: number | null;
      tax_amount?: number | null;
      paid_amount?: number;
      remaining?: number;
      status?: string;
    }[];
    const payments = (listSupplierPayments(supplierId) as {
      payment_date?: string;
      method?: string;
      invoice_id?: string | null;
      amount?: number;
      note?: string;
      status?: string;
    }[]).filter((p) => String(p.status || 'POSTED').toUpperCase() !== 'VOID');
    const invoiceNo = new Map(invoices.map((i) => [i.id, i.invoice_no || '']));
    const statement = supplierStatement(supplierId);
    const html = buildSupplierCardHtml({
      name_ar: supplier.name_ar || supplierId,
      code: supplier.code || '',
      category: supplier.category,
      scf_code: supplier.scf_code,
      contact: supplier.contact,
      payment_terms_days: supplier.payment_terms_days,
      invoices: invoices
        .filter((i) => String(i.status || '').toUpperCase() !== 'VOID')
        .map((i) => ({
          invoice_no: i.invoice_no || '',
          invoice_date: String(i.invoice_date || '').slice(0, 10),
          due_date: String(i.due_date || '').slice(0, 10),
          amount_ht: Number(i.amount_ht) > 0 ? Number(i.amount_ht) : Number(i.amount) || 0,
          discount: Number(i.discount) || 0,
          tax_amount: Number(i.tax_amount) || 0,
          amount: Number(i.amount) || 0,
          paid_amount: Number(i.paid_amount) || 0,
          remaining: Number(i.remaining) || 0,
          status: i.status || '',
        })),
      payments: payments.map((p) => ({
        payment_date: String(p.payment_date || '').slice(0, 10),
        method: p.method || '',
        invoice_no: p.invoice_id ? invoiceNo.get(p.invoice_id) || '' : '',
        amount: Number(p.amount) || 0,
        note: p.note || '',
      })),
      lines: (statement.lines || []).map((l) => ({
        date: l.date,
        ref: l.ref,
        label: l.label,
        debit: l.debit,
        credit: l.credit,
        balance: l.balance,
      })),
    });
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Doc-Mode': 'supplier',
      },
    });
  }

  const known = listSuppliers() as { id: string; status?: string; scf_code?: string | null; category?: string | null }[];
  const meta = new Map(known.map((s) => [s.id, s]));
  const rows = (supplierStatusList() as {
    id: string;
    name_ar: string;
    code?: string;
    category?: string | null;
    total_invoiced: number;
    total_paid: number;
    total_remaining: number;
    settlement: string;
  }[])
    .filter((row) => {
      const src = meta.get(row.id);
      if (src && String(src.status || 'ACTIVE').toUpperCase() === 'INACTIVE') return false;
      if (!lane) return true;
      return supplierLane({ category: src?.category ?? row.category, scf_code: src?.scf_code }) === lane;
    })
    .map((row) => ({
      name_ar: row.name_ar,
      code: row.code || '',
      category: row.category,
      total_invoiced: row.total_invoiced,
      total_paid: row.total_paid,
      total_remaining: row.total_remaining,
      settlement: row.settlement,
    }));

  const laneLabel = SUPPLIER_LANES.find((l) => l.id === lane)?.label;
  const title = laneLabel || 'كل الموردين';
  const html = buildSupplierBookHtml({ title, from, to, rows });
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Doc-Mode': 'suppliers',
    },
  });
}

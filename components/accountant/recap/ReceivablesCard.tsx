'use client';

import { useState } from 'react';
import { Scale } from 'lucide-react';
import SummaryCard from './SummaryCard';
import { BarList, CHART_COLORS } from '../Charts';
import { fmtCount, fmtMoney } from '../money';
import { SlideList, SlideListEmpty, SlideListItem } from '../ui';

type ClientRow = {
  id: string;
  reference: string;
  name: string;
  package_name: string;
  total: number;
  paid: number;
  remaining: number;
  date: string;
};

type SupplierRow = {
  id: string;
  name_ar: string;
  code: string;
  remaining: number;
  overdue: number;
  open_count: number;
};

type Props = {
  open: boolean;
  onToggle: () => void;
  clientDebt: number | null;
  supplierDebt: number | null;
  net: number | null;
  openInvoices: number | null;
  clientRows: ClientRow[];
  supplierRows: SupplierRow[];
  clientDebtByType: { id: string; label: string; amount: number }[];
  onOpenSuppliers: () => void;
};

export default function ReceivablesCard({
  open,
  onToggle,
  clientDebt,
  supplierDebt,
  net,
  openInvoices,
  clientRows,
  supplierRows,
  clientDebtByType,
  onOpenSuppliers,
}: Props) {
  const [side, setSide] = useState<'clients' | 'suppliers'>('clients');
  const [rowId, setRowId] = useState('');

  return (
    <SummaryCard
      icon={<Scale className="w-4 h-4 text-violet-600" aria-hidden />}
      title="المستحقات"
      open={open}
      onToggle={onToggle}
      figures={[
        { label: 'عملاء', value: clientDebt, tone: 'text-violet-700' },
        { label: 'موردون', value: supplierDebt, tone: 'text-amber-700' },
      ]}
      result={{ label: 'الصافي', value: net }}
      action={
        <button
          type="button"
          className="px-3 py-1.5 rounded-xl acct-muted text-xs font-bold cursor-pointer"
          onClick={onOpenSuppliers}
        >
          الموردون ‹
        </button>
      }
    >
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--acct-input)' }} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={side === 'clients'}
          onClick={() => {
            setSide('clients');
            setRowId('');
          }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
            side === 'clients' ? 'bg-emerald-600 text-white' : 'opacity-70'
          }`}
        >
          مستحقات العملاء ({fmtCount(clientRows.length)})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={side === 'suppliers'}
          onClick={() => {
            setSide('suppliers');
            setRowId('');
          }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
            side === 'suppliers' ? 'bg-emerald-600 text-white' : 'opacity-70'
          }`}
        >
          ديون الموردين ({fmtCount(supplierRows.length)})
        </button>
      </div>

      {side === 'clients' ? (
        <>
          <SlideList nested>
            {clientRows.map((r, i) => {
              const rowOpen = rowId === r.id;
              return (
                <SlideListItem
                  key={r.id}
                  index={i}
                  open={rowOpen}
                  onToggle={() => setRowId(rowOpen ? '' : r.id)}
                  accent={r.remaining > 0 ? 'due' : 'settled'}
                  row={
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold truncate">{r.name || '—'}</span>
                        <span className="block text-[10px] opacity-60 font-bold font-mono mt-0.5">{r.reference}</span>
                      </span>
                      <span className="text-sm font-black tabular-nums text-violet-700 shrink-0">
                        {fmtMoney(r.remaining)}
                      </span>
                    </>
                  }
                >
                  <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Cell label="الإجمالي">{fmtMoney(r.total)}</Cell>
                    <Cell label="المدفوع">{fmtMoney(r.paid)}</Cell>
                    <Cell label="المتبقي">{fmtMoney(r.remaining)}</Cell>
                    <Cell label="تاريخ الحجز">{r.date || '—'}</Cell>
                    <div className="col-span-2 sm:col-span-4">
                      <div className="text-[10px] font-bold opacity-55">الباقة</div>
                      <div className="text-xs font-bold">{r.package_name || '—'}</div>
                    </div>
                  </div>
                </SlideListItem>
              );
            })}
            {clientRows.length === 0 ? <SlideListEmpty>لا مستحقات على العملاء</SlideListEmpty> : null}
          </SlideList>

          <div className="pt-3 border-t" style={{ borderColor: 'var(--acct-border)' }}>
            <h4 className="text-xs font-black mb-2">المستحقات حسب النشاط</h4>
            <BarList
              items={clientDebtByType.map((t) => ({
                id: t.id,
                label: t.label,
                value: t.amount,
                color: CHART_COLORS.client,
              }))}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] opacity-55">
            {openInvoices == null ? '' : `${fmtCount(openInvoices)} فاتورة مورد مفتوحة`}
          </p>
          <SlideList nested>
            {supplierRows.map((s, i) => {
              const rowOpen = rowId === s.id;
              return (
                <SlideListItem
                  key={s.id}
                  index={i}
                  open={rowOpen}
                  onToggle={() => setRowId(rowOpen ? '' : s.id)}
                  accent={s.overdue > 0 ? 'overdue' : s.remaining > 0 ? 'due' : 'settled'}
                  row={
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold truncate">{s.name_ar}</span>
                        {s.overdue > 0 && (
                          <span className="text-[10px] font-bold text-rose-600 mt-0.5 block">
                            متأخر {fmtMoney(s.overdue)}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-black tabular-nums text-amber-700 shrink-0">
                        {fmtMoney(s.remaining)}
                      </span>
                    </>
                  }
                >
                  <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Cell label="الرمز">{s.code || '—'}</Cell>
                    <Cell label="فواتير مفتوحة">{fmtCount(s.open_count)}</Cell>
                    <Cell label="الرصيد">{fmtMoney(s.remaining)}</Cell>
                    <Cell label="المتأخر">{fmtMoney(s.overdue)}</Cell>
                  </div>
                </SlideListItem>
              );
            })}
            {supplierRows.length === 0 ? <SlideListEmpty>لا ديون للموردين</SlideListEmpty> : null}
          </SlideList>
        </>
      )}
    </SummaryCard>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold opacity-55">{label}</div>
      <div className="text-xs font-bold tabular-nums mt-0.5">{children}</div>
    </div>
  );
}

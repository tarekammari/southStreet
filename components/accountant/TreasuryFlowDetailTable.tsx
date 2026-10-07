'use client';

import { useMemo } from 'react';
import type { TreasuryFlowMove } from '@/lib/finance';
import { fmtCount, fmtMoney, payMethodLabel } from './money';

const FLOW_HINTS: Record<string, string> = {
  supplier_out: '401 → 512/53 · دفعات مسجّلة على الموردين (خروج نقدي فعلي)',
  client_in: '512/53 ← 411/419 · تحصيلات العملاء',
  service_out: '613/626 → 512/53 · خدمات دورية مدفوعة',
  payroll_out: '421 → 512/53 · رواتب وأجور',
  other_out: '62x → 512/53 · مصاريف تشغيلية من الخزينة',
};

type Col = { key: string; label: string; className?: string };

function columnsForFlow(flowId: string): Col[] {
  switch (flowId) {
    case 'supplier_out':
      return [
        { key: 'date', label: 'التاريخ' },
        { key: 'party', label: 'المورد' },
        { key: 'ref', label: 'الفاتورة / المرجع' },
        { key: 'detail', label: 'البيان' },
        { key: 'method', label: 'طريقة الدفع' },
        { key: 'account', label: 'حساب الخزينة' },
        { key: 'amount', label: 'المبلغ', className: 'acct-num' },
      ];
    case 'client_in':
      return [
        { key: 'date', label: 'التاريخ' },
        { key: 'party', label: 'العميل' },
        { key: 'ref', label: 'البرنامج' },
        { key: 'detail', label: 'البيان' },
        { key: 'method', label: 'طريقة الدفع' },
        { key: 'account', label: 'حساب الخزينة' },
        { key: 'amount', label: 'المبلغ', className: 'acct-num' },
      ];
    case 'payroll_out':
      return [
        { key: 'date', label: 'التاريخ' },
        { key: 'party', label: 'الموظف' },
        { key: 'ref', label: 'الفترة' },
        { key: 'detail', label: 'البيان' },
        { key: 'method', label: 'طريقة الدفع' },
        { key: 'account', label: 'حساب الخزينة' },
        { key: 'amount', label: 'المبلغ', className: 'acct-num' },
      ];
    case 'service_out':
      return [
        { key: 'date', label: 'التاريخ' },
        { key: 'party', label: 'الخدمة' },
        { key: 'detail', label: 'البيان' },
        { key: 'method', label: 'طريقة الدفع' },
        { key: 'account', label: 'حساب الخزينة' },
        { key: 'amount', label: 'المبلغ', className: 'acct-num' },
      ];
    default:
      return [
        { key: 'date', label: 'التاريخ' },
        { key: 'party', label: 'الطرف' },
        { key: 'ref', label: 'مرجع' },
        { key: 'detail', label: 'البيان' },
        { key: 'method', label: 'طريقة الدفع' },
        { key: 'account', label: 'حساب الخزينة' },
        { key: 'amount', label: 'المبلغ', className: 'acct-num' },
      ];
  }
}

function refCell(flowId: string, m: TreasuryFlowMove) {
  if (flowId === 'supplier_out') {
    if (m.invoice_no) return m.invoice_no;
    if (m.supplier_code) return m.supplier_code;
    return m.payment_id ? `#${m.payment_id.slice(-6)}` : '—';
  }
  if (flowId === 'client_in') return m.package_name || m.customer_code || '—';
  if (flowId === 'payroll_out') return m.period_label || '—';
  if (flowId === 'service_out') return '—';
  return m.ref_id ? `#${String(m.ref_id).slice(-6)}` : '—';
}

function partyCell(flowId: string, m: TreasuryFlowMove) {
  if (flowId === 'service_out') return m.service_name || m.counterparty || '—';
  if (flowId === 'payroll_out') return m.staff_name || m.counterparty || '—';
  return m.counterparty || '—';
}

function detailCell(m: TreasuryFlowMove) {
  const parts = [m.detail_note, m.description].filter(Boolean);
  const text = parts.join(' · ') || '—';
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

export default function TreasuryFlowDetailTable({
  flowId,
  periodFrom,
  periodTo,
  moves,
  onOpenSupplier,
}: {
  flowId: string;
  periodFrom: string;
  periodTo: string;
  moves: TreasuryFlowMove[];
  onOpenSupplier?: (supplierId: string) => void;
}) {
  const cols = columnsForFlow(flowId);
  const total = useMemo(() => moves.reduce((s, m) => s + m.amount, 0), [moves]);
  const hint = FLOW_HINTS[flowId];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm acct-top-subtitle max-w-2xl">
          حركات نقدية فعلية · الفترة {periodFrom} → {periodTo}
          {hint ? ` · ${hint}` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--acct-input)' }}>
            <span className="font-bold opacity-60">عدد العمليات </span>
            <span className="font-black tabular-nums">{fmtCount(moves.length)}</span>
          </div>
          <div className="rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--acct-input)' }}>
            <span className="font-bold opacity-60">إجمالي الفترة </span>
            <span
              className={`font-black tabular-nums ${
                moves[0]?.direction === 'in' ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {moves[0]?.direction === 'in' ? '+' : '−'}
              {fmtMoney(total)}
            </span>
          </div>
        </div>
      </div>

      {moves.length === 0 ? (
        <p className="text-sm opacity-60 py-4 text-center">لا حركات مطابقة في هذه الفترة</p>
      ) : (
        <div className="acct-fin-table-wrap max-h-[min(28rem,55vh)] overflow-auto">
          <table className="acct-fin-table acct-kpi-detail-table text-sm">
            <thead>
              <tr className="acct-fin-detail-head">
                {cols.map((c) => (
                  <th key={c.key} className={c.className}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => {
                const canOpenSupplier = flowId === 'supplier_out' && m.supplier_id && onOpenSupplier;
                const renderCell = (key: string) => {
                  switch (key) {
                    case 'date':
                      return (
                        <td key={key} className="tabular-nums whitespace-nowrap font-medium">
                          {m.entry_date}
                        </td>
                      );
                    case 'party':
                      return (
                        <td key={key} className="font-bold min-w-[8rem]">
                          {canOpenSupplier ? (
                            <button
                              type="button"
                              className="acct-fin-link text-right font-bold"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenSupplier!(m.supplier_id!);
                              }}
                            >
                              {partyCell(flowId, m)}
                            </button>
                          ) : (
                            partyCell(flowId, m)
                          )}
                          {flowId === 'supplier_out' && m.supplier_code ? (
                            <span className="block text-[11px] font-bold opacity-50">{m.supplier_code}</span>
                          ) : null}
                        </td>
                      );
                    case 'ref':
                      return (
                        <td key={key} className="text-[13px]">
                          {refCell(flowId, m)}
                        </td>
                      );
                    case 'detail':
                      return (
                        <td
                          key={key}
                          className="text-[13px] opacity-90 max-w-[14rem] truncate"
                          title={detailCell(m)}
                        >
                          {detailCell(m)}
                        </td>
                      );
                    case 'method':
                      return (
                        <td key={key} className="text-[13px] whitespace-nowrap">
                          {payMethodLabel(m.method)}
                        </td>
                      );
                    case 'account':
                      return (
                        <td key={key} className="text-[13px] whitespace-nowrap">
                          {m.account_name}
                        </td>
                      );
                    case 'amount':
                      return (
                        <td
                          key={key}
                          className={`acct-num font-black tabular-nums whitespace-nowrap ${
                            m.direction === 'in' ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {m.direction === 'in' ? '+' : '−'}
                          {fmtMoney(m.amount)}
                        </td>
                      );
                    default:
                      return null;
                  }
                };
                return (
                  <tr
                    key={m.id}
                    className={canOpenSupplier ? 'acct-kpi-detail-row-btn cursor-pointer' : undefined}
                    onClick={
                      canOpenSupplier ? () => onOpenSupplier!(m.supplier_id!) : undefined
                    }
                    title={canOpenSupplier ? 'فتح ملف المورد' : undefined}
                  >
                    {cols.map((c) => renderCell(c.key))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="acct-kpi-detail-total-row font-black">
                <td colSpan={cols.length - 1}>الإجمالي ({fmtCount(moves.length)} عملية)</td>
                <td
                  className={`acct-num tabular-nums ${
                    moves[0]?.direction === 'in' ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {moves[0]?.direction === 'in' ? '+' : '−'}
                  {fmtMoney(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

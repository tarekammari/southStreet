'use client';

import { useState } from 'react';
import { Landmark } from 'lucide-react';
import SummaryCard from './SummaryCard';
import { fmtCount, fmtMoney } from '../money';
import { SlideList, SlideListEmpty, SlideListItem } from '../ui';
import { treasuryKindLabel } from '@/lib/finance-categories';

export type TreasuryAccountView = {
  id: string;
  name_ar: string;
  kind: string;
  bank_name: string;
  account_no: string;
  opening_balance: number;
  status: string;
  balance: number;
  inflow: number;
  outflow: number;
  movements_count: number;
  period_inflow: number;
  period_outflow: number;
  period_opening?: number;
  period_closing?: number;
  last_movement: string;
  recent: {
    id: string;
    entry_date: string;
    description: string;
    counterparty: string;
    amount: number;
    direction: string;
    type?: string;
    category?: string;
  }[];
};

export type TreasuryView = {
  accounts: TreasuryAccountView[];
  cash_total: number;
  bank_total: number;
  ccp_total?: number;
  bank_only_total?: number;
  kind_totals?: { CASH: number; BANK: number; CCP: number; OTHER: number };
  other_total: number;
  total: number;
  accounts_count: number;
  period_opening?: number;
  period_inflow?: number;
  period_outflow?: number;
  period_closing?: number;
  accounts_period_totals?: {
    opening: number;
    inflow: number;
    outflow: number;
    closing: number;
  };
  cash_flow?: {
    lines: { id: string; label: string; amount: number; kind: 'in' | 'out'; section?: string }[];
    total_in: number;
    total_out: number;
    net: number;
  };
  flow_moves?: import('@/lib/finance').TreasuryFlowMove[];
  all_flow_moves?: Record<string, import('@/lib/finance').TreasuryFlowMove[]>;
  selected_account?: TreasuryAccountView | null;
  account_moves?: import('@/lib/finance').TreasuryAccountMove[];
  unassigned: {
    balance: number;
    inflow: number;
    outflow: number;
    count: number;
    period_opening?: number;
    period_inflow?: number;
    period_outflow?: number;
    period_closing?: number;
    recent?: {
      id: string;
      entry_date: string;
      description: string;
      counterparty: string;
      amount: number;
      direction: string;
      type?: string;
      category?: string;
    }[];
  };
};

export default function TreasuryCard({
  open,
  onToggle,
  treasury,
  onManage,
}: {
  open: boolean;
  onToggle: () => void;
  treasury: TreasuryView | null;
  onManage: () => void;
}) {
  const [accountId, setAccountId] = useState('');
  const accounts = treasury?.accounts || [];

  return (
    <SummaryCard
      icon={<Landmark className="w-4 h-4 text-sky-600" aria-hidden />}
      title="الخزينة"
      open={open}
      onToggle={onToggle}
      figures={[
        { label: 'نقد', value: treasury?.kind_totals?.CASH ?? treasury?.cash_total ?? null, tone: 'text-emerald-700' },
        {
          label: 'بنوك',
          value: treasury?.bank_only_total ?? treasury?.bank_total ?? null,
          tone: 'text-sky-700',
        },
        { label: 'CCP', value: treasury?.ccp_total ?? null, tone: 'text-indigo-700' },
      ]}
      result={{ label: 'الإجمالي', value: treasury?.total ?? null, kind: 'stock' }}
      action={
        <button
          type="button"
          className="px-3 py-1.5 rounded-xl acct-muted text-xs font-bold cursor-pointer"
          onClick={onManage}
        >
          الخزينة ‹
        </button>
      }
    >
      <SlideList nested>
        {accounts.map((a, i) => {
          const rowOpen = accountId === a.id;
          return (
            <SlideListItem
              key={a.id}
              index={i}
              open={rowOpen}
              onToggle={() => setAccountId(rowOpen ? '' : a.id)}
              row={
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold truncate">
                      {a.name_ar}
                      {a.status === 'CLOSED' && <span className="opacity-50 font-normal"> · مغلق</span>}
                    </span>
                    <span className="block text-[10px] font-bold opacity-60 mt-0.5">
                      {treasuryKindLabel(a.kind)}
                      {a.bank_name ? ` · ${a.bank_name}` : ''}
                    </span>
                  </span>
                  <span
                    className={`text-sm font-black tabular-nums shrink-0 ${
                      a.balance >= 0 ? 'text-sky-700' : 'text-rose-600'
                    }`}
                  >
                    {fmtMoney(a.balance)}
                  </span>
                </>
              }
            >
              <div className="px-3 pb-3 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <Cell label="رصيد افتتاحي">{fmtMoney(a.opening_balance)}</Cell>
                  <Cell label="إجمالي الداخل">{fmtMoney(a.inflow)}</Cell>
                  <Cell label="إجمالي الخارج">{fmtMoney(a.outflow)}</Cell>
                  <Cell label="عدد الحركات">{fmtCount(a.movements_count)}</Cell>
                  <Cell label="داخل الفترة">{fmtMoney(a.period_inflow)}</Cell>
                  <Cell label="خارج الفترة">{fmtMoney(a.period_outflow)}</Cell>
                  <Cell label="رقم الحساب">{a.account_no || '—'}</Cell>
                  <Cell label="آخر حركة">{a.last_movement || '—'}</Cell>
                </div>

                {a.recent.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-black opacity-55 mb-1">آخر الحركات في الفترة</h5>
                    <ul className="space-y-1">
                      {a.recent.slice(0, 8).map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="min-w-0 truncate">
                            <span className="opacity-50 tabular-nums">{m.entry_date}</span>{' '}
                            {m.description || m.counterparty || '—'}
                          </span>
                          <span
                            className={`tabular-nums font-bold shrink-0 ${
                              m.direction === 'in' ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {m.direction === 'in' ? '+' : '−'}
                            {fmtMoney(m.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </SlideListItem>
          );
        })}
        {accounts.length === 0 ? (
          <SlideListEmpty>لا حسابات خزينة — أضف صندوقاً أو حساباً بنكياً من «الخزينة».</SlideListEmpty>
        ) : null}
      </SlideList>

      {treasury && treasury.unassigned.count > 0 && (
        <p className="text-[11px] text-amber-700 font-bold">
          {fmtCount(treasury.unassigned.count)} حركة غير مخصّصة لأي حساب (صافي {fmtMoney(treasury.unassigned.balance)})
          — حدّد الحساب عند إدخال القيد لتظهر ضمن الأرصدة.
        </p>
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

'use client';

import { Boxes } from 'lucide-react';
import SummaryCard from './SummaryCard';
import { BarList, CHART_COLORS, Donut, type ChartItem } from '../Charts';
import { fmtMoney } from '../money';
import { assetCategoryLabel } from '@/lib/finance-categories';

const SLICES = [
  '#0284c7', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2',
  '#65a30d', '#c026d3', '#ea580c', '#475569', '#0d9488', '#9333ea', '#64748b',
];

export type AssetsView = {
  by_category: { id: string; label: string; count: number; quantity: number; total_cost: number; net_book_value: number }[];
  total_cost: number;
  net_book_value: number;
  accumulated_depreciation: number;
  count: number;
  active_count: number;
  added_in_period: number;
};

export default function InvestmentsCard({
  open,
  onToggle,
  assets,
  onManage,
}: {
  open: boolean;
  onToggle: () => void;
  assets: AssetsView | null;
  onManage: () => void;
}) {
  const bars: ChartItem[] = (assets?.by_category || []).map((c) => ({
    id: c.id,
    label: `${assetCategoryLabel(c.id)} (${c.quantity})`,
    value: c.total_cost,
    color: CHART_COLORS.assets,
  }));

  const slices: ChartItem[] = (assets?.by_category || []).map((c, i) => ({
    id: c.id,
    label: assetCategoryLabel(c.id),
    value: c.total_cost,
    color: SLICES[i % SLICES.length],
  }));

  return (
    <SummaryCard
      icon={<Boxes className="w-4 h-4 text-sky-600" aria-hidden />}
      title="الأصول"
      open={open}
      onToggle={onToggle}
      figures={[
        { label: 'التكلفة', value: assets?.total_cost ?? null, tone: 'text-sky-700' },
        { label: 'الدفترية', value: assets?.net_book_value ?? null, tone: 'text-emerald-700' },
        { label: 'الإهلاك', value: assets?.accumulated_depreciation ?? null, tone: 'text-amber-700' },
      ]}
      action={
        <button
          type="button"
          className="px-3 py-1.5 rounded-xl acct-muted text-xs font-bold cursor-pointer"
          onClick={onManage}
        >
          الأصول ‹
        </button>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Cell label="عدد الأصول">{assets ? `${assets.active_count} / ${assets.count}` : '—'}</Cell>
        <Cell label="مشتريات الفترة">{assets ? fmtMoney(assets.added_in_period) : '—'}</Cell>
        <Cell label="تصنيفات مستعملة">{assets ? assets.by_category.length : '—'}</Cell>
        <Cell label="نسبة الاستهلاك">
          {assets && assets.total_cost > 0
            ? `${Math.round((assets.accumulated_depreciation / assets.total_cost) * 100)}%`
            : '—'}
        </Cell>
      </div>

      {assets && assets.count > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-3 border-t" style={{ borderColor: 'var(--acct-border)' }}>
          <BarList items={bars} />
          <Donut items={slices} centerLabel="أصل" centerValue={String(assets.count)} />
        </div>
      ) : (
        <p className="py-6 text-center text-xs opacity-50">لا أصول مسجّلة — أضفها من «الاستثمارات».</p>
      )}
    </SummaryCard>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--acct-input)' }}>
      <div className="text-[10px] font-bold opacity-55">{label}</div>
      <div className="text-xs font-bold tabular-nums mt-0.5">{children}</div>
    </div>
  );
}

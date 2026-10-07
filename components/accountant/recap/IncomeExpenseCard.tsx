'use client';

import { ArrowLeftRight } from 'lucide-react';
import SummaryCard from './SummaryCard';
import { BarList, CHART_COLORS, TrendChart } from '../Charts';

type Props = {
  open: boolean;
  onToggle: () => void;
  income: number | null;
  spending: number | null;
  net: number | null;
  monthly: { month: string; income: number; spending: number }[];
  spendingByCategory: { id: string; label: string; amount: number }[];
  collectedByType: { id: string; label: string; amount: number }[];
};

export default function IncomeExpenseCard({
  open,
  onToggle,
  income,
  spending,
  net,
  monthly,
  spendingByCategory,
  collectedByType,
}: Props) {
  return (
    <SummaryCard
      icon={<ArrowLeftRight className="w-4 h-4 text-emerald-600" aria-hidden />}
      title="الحركة"
      open={open}
      onToggle={onToggle}
      figures={[
        { label: 'مداخيل', value: income, tone: 'text-emerald-700' },
        { label: 'مصروفات', value: spending, tone: 'text-rose-600' },
      ]}
      result={{ label: 'النتيجة', value: net }}
    >
      <div>
        <h4 className="text-xs font-extrabold mb-2">الشهر</h4>
        <TrendChart data={monthly} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-1 border-t" style={{ borderColor: 'var(--acct-border)' }}>
        <div className="pt-3">
          <h4 className="text-xs font-extrabold mb-2">المصروفات</h4>
          <BarList
            items={spendingByCategory.map((c) => ({
              id: c.id,
              label: c.label,
              value: c.amount,
              color: CHART_COLORS.spending,
            }))}
          />
        </div>
        <div className="pt-3">
          <h4 className="text-xs font-extrabold mb-2">المقبوضات</h4>
          <BarList
            items={collectedByType.map((t) => ({
              id: t.id,
              label: t.label,
              value: t.amount,
              color: CHART_COLORS.income,
            }))}
          />
        </div>
      </div>
    </SummaryCard>
  );
}

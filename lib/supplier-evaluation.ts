import type { SettlementState } from '@/lib/finance';

export type SupplierEvaluationInput = {
  settlement: SettlementState | string;
  total_invoiced: number;
  total_paid: number;
  balance: number;
  paid_ratio: number;
  overdue_amount: number;
  avg_settlement_days: number | null;
  payment_terms_days: number;
  invoice_count: number;
};

export type SupplierEvaluation = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | '—';
  label_ar: string;
  summary_ar: string;
  factors: { text: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }[];
};

/** Score supplier relationship from payment discipline (SCF — tiers / 401). */
export function evaluateSupplierOps(input: SupplierEvaluationInput): SupplierEvaluation {
  const factors: SupplierEvaluation['factors'] = [];
  if (input.invoice_count <= 0) {
    return {
      score: 0,
      grade: '—',
      label_ar: 'بدون عمليات بعد',
      summary_ar: 'لا فواتير — لا يمكن تقييم الالتزام بالسداد.',
      factors: [{ text: 'سجّل فاتورة أو دفعة لبدء التقييم', tone: 'neutral' }],
    };
  }

  let score = 70;
  const settlement = String(input.settlement || '').toUpperCase();

  if (settlement === 'PAID_FULL') {
    score += 20;
    factors.push({ text: 'جميع الفواتير مسددة (خالص)', tone: 'ok' });
  } else if (settlement === 'OVERDUE') {
    score -= 28;
    factors.push({ text: 'تأخير في السداد — ذمم متأخرة', tone: 'bad' });
  } else if (settlement === 'DUE_SOON') {
    score -= 10;
    factors.push({ text: 'استحقاق قريب — متابعة الدفع', tone: 'warn' });
  } else if (settlement === 'OPEN') {
    factors.push({ text: 'ذمم مفتوحة ضمن الأجل', tone: 'neutral' });
  }

  const ratio = input.paid_ratio;
  if (ratio >= 90) {
    score += 8;
    factors.push({ text: `نسبة السداد ${ratio}% — ممتاز`, tone: 'ok' });
  } else if (ratio >= 60) {
    factors.push({ text: `نسبة السداد ${ratio}%`, tone: 'neutral' });
  } else if (input.balance > 0) {
    score -= 12;
    factors.push({ text: `نسبة السداد منخفضة (${ratio}%)`, tone: 'warn' });
  }

  if (input.overdue_amount > 0) {
    score -= Math.min(15, Math.round(input.overdue_amount / Math.max(input.total_invoiced, 1) * 30));
    factors.push({ text: 'مبلغ متأخر على فواتير مفتوحة', tone: 'bad' });
  }

  const terms = Math.max(1, input.payment_terms_days || 30);
  if (input.avg_settlement_days != null && input.invoice_count > 0) {
    if (input.avg_settlement_days <= terms) {
      score += 6;
      factors.push({ text: `متوسط السداد ${input.avg_settlement_days} يوم (≤ ${terms})`, tone: 'ok' });
    } else {
      score -= Math.min(12, input.avg_settlement_days - terms);
      factors.push({
        text: `متوسط السداد ${input.avg_settlement_days} يوم (> أجل ${terms} يوم)`,
        tone: 'warn',
      });
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let grade: SupplierEvaluation['grade'] = 'D';
  let label_ar = 'ضعيف — مخاطر سداد';
  if (score >= 85) {
    grade = 'A';
    label_ar = 'ممتاز — موثوق';
  } else if (score >= 70) {
    grade = 'B';
    label_ar = 'جيد';
  } else if (score >= 50) {
    grade = 'C';
    label_ar = 'متوسط — مراقبة';
  }

  const summary_ar =
    input.balance <= 0
      ? 'لا ذمم متبقية — علاقة مالية منظمة.'
      : `متبقٍ ${Math.round((input.balance / Math.max(input.total_invoiced, 1)) * 100)}% من إجمالي المفوتر على هذا المورد.`;

  return { score, grade, label_ar, summary_ar, factors };
}

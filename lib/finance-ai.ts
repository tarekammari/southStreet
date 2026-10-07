/**
 * Sakhr's finance brain: answers an accountant's questions from live ledger,
 * treasury, supplier, payroll and asset data instead of free-form generation,
 * so every figure it states can be traced back to a record in the database.
 *
 * Deliberately deterministic — a wrong number in an accounting answer is worse
 * than no answer, so unmatched questions say so and suggest what can be asked.
 */

import {
  assetsSummary,
  clientAccountBalances,
  dailyJournal,
  financeRecap,
  payrollByStaff,
  supplierStatusList,
  treasuryOverview,
} from './finance';
import {
  TRIP_TYPES,
  assetCategoryLabel,
  ledgerCategoryLabel,
  supplierCategoryLabel,
  tripTypeLabel,
} from './finance-categories';

/* ------------------------------------------------------------------ *
 * Money + period helpers (server side, plain digits for the model).
 * ------------------------------------------------------------------ */

const money = (n: number) =>
  `${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ')} دج`;

const pct = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : '—';

export type FinancePeriodId = 'month' | 'quarter' | 'year' | 'all';

export type FinanceRange = { id: FinancePeriodId; label: string; from?: string; to?: string };

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function resolvePeriod(id: FinancePeriodId): FinanceRange {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (id === 'month') {
    return {
      id,
      label: 'هذا الشهر',
      from: iso(new Date(Date.UTC(y, m, 1))),
      to: iso(new Date(Date.UTC(y, m + 1, 0))),
    };
  }
  if (id === 'quarter') {
    const q = Math.floor(m / 3) * 3;
    return {
      id,
      label: 'هذا الفصل',
      from: iso(new Date(Date.UTC(y, q, 1))),
      to: iso(new Date(Date.UTC(y, q + 3, 0))),
    };
  }
  if (id === 'year') {
    return { id, label: 'هذه السنة', from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return { id: 'all', label: 'كل الفترات' };
}

/** Pull a period out of the wording of the question itself. */
function periodFromText(text: string): FinancePeriodId | null {
  if (/هذا الشهر|الشهر الحالي|شهري|هذا الشّهر/.test(text)) return 'month';
  if (/الفصل|الربع|ثلاثة أشهر|3 أشهر/.test(text)) return 'quarter';
  if (/هذه السنة|السنة الحالية|سنوي|العام الحالي|هذا العام/.test(text)) return 'year';
  if (/كل الفترات|الكل|من البداية|الإجمالي العام|كامل/.test(text)) return 'all';
  return null;
}

/** Pull an activity line (Umrah / Hajj / other) out of the question. */
function tripFromText(text: string): string | null {
  if (/حج\b|الحج|حجة/.test(text)) return 'hajj';
  if (/عمرة|العمرة|عمره/.test(text)) return 'umrah';
  return null;
}

/* ------------------------------------------------------------------ *
 * Intents: the questions an accountant actually asks this dashboard.
 * ------------------------------------------------------------------ */

export type FinanceArea =
  | 'overview'
  | 'treasury'
  | 'ledger'
  | 'receipts'
  | 'suppliers'
  | 'payroll'
  | 'assets';

export type FinanceAnswer = {
  /** Intent that matched, or `unknown`. */
  intent: string;
  question: string;
  /** Short headline the panel shows in bold. */
  headline: string;
  /** Supporting figures, already formatted. */
  lines: { label: string; value: string; tone?: 'good' | 'bad' | 'warn' }[];
  /** Free-text reading of the numbers. */
  note?: string;
  /** Dashboard section the accountant should open to act on it. */
  area?: FinanceArea;
  period: { id: FinancePeriodId; label: string };
  trip_type?: string | null;
  matched: boolean;
};

type Intent = {
  id: string;
  /** Any keyword group matching means the intent fires. */
  keywords: RegExp;
  area: FinanceArea;
  run: (ctx: Ctx) => Omit<FinanceAnswer, 'intent' | 'question' | 'period' | 'matched' | 'area'>;
};

type Ctx = {
  text: string;
  range: FinanceRange;
  trip: string | null;
  recap: ReturnType<typeof financeRecap>;
};

/**
 * Order matters: the first regex that matches wins, so narrow questions such as
 * "الفرق بين مستحقات العملاء ودين الموردين" have to be tested before the broad
 * profit / receivables intents that share their vocabulary.
 */
const INTENTS: Intent[] = [
  {
    id: 'receivables_net',
    keywords:
      /صافي المستحقات|مركزنا|وضعنا تجاه|المطلوب والمستحق|الفرق بين[^؟]*(الموردين|العملاء)|(الموردين|العملاء)[^؟]*الفرق بين/,
    area: 'overview',
    run: ({ recap }) => {
      const positive = recap.receivables_net >= 0;
      return {
        headline: `صافي المستحقات: ${positive ? '+' : '−'}${money(Math.abs(recap.receivables_net))}`,
        lines: [
          { label: 'مستحقات لنا على العملاء', value: money(recap.client_debt), tone: 'good' },
          { label: 'دين علينا للموردين', value: money(recap.supplier_debt), tone: 'bad' },
          {
            label: 'الصافي',
            value: `${positive ? '+' : '−'}${money(Math.abs(recap.receivables_net))}`,
            tone: positive ? 'good' : 'bad',
          },
        ],
        note: positive
          ? 'ما لنا عند العملاء يغطي ما علينا للموردين.'
          : 'ما علينا للموردين أكبر مما لنا عند العملاء — تابع التحصيل قبل جدولة الدفعات.',
      };
    },
  },
  {
    id: 'by_trip',
    keywords: /مقارنة|قارن|حسب النشاط|العمرة والحج|أي نشاط|الأنشطة|البرامج|البرنامج الأكثر/,
    area: 'overview',
    run: ({ recap }) => ({
      headline: 'التحصيل والمستحقات حسب النشاط',
      lines: TRIP_TYPES.flatMap((t) => {
        const collected = recap.collected_by_type.find((x) => x.id === t.id)?.amount || 0;
        const debt = recap.client_debt_by_type.find((x) => x.id === t.id)?.amount || 0;
        if (!collected && !debt) return [];
        return [
          { label: `${t.label} — محصّل`, value: money(collected), tone: 'good' as const },
          { label: `${t.label} — مستحق`, value: money(debt), tone: 'warn' as const },
        ];
      }),
      note: `أعلى نشاط تحصيلاً: ${
        [...recap.collected_by_type].sort((a, b) => b.amount - a.amount)[0]?.label || '—'
      }.`,
    }),
  },
  {
    id: 'collection_rate',
    keywords: /نسبة التحصيل|كفاءة التحصيل|كم بقي لنا|معدل السداد/,
    area: 'receipts',
    run: ({ recap, range }) => {
      const billed = recap.income + recap.client_debt;
      return {
        headline: `نسبة التحصيل (${range.label}): ${pct(recap.income, billed)}`,
        lines: [
          { label: 'المحصّل', value: money(recap.income), tone: 'good' },
          { label: 'غير المحصّل', value: money(recap.client_debt), tone: 'warn' },
          { label: 'إجمالي المفوتر', value: money(billed) },
        ],
        note: `كل 100 دج مفوترة تم تحصيل ${pct(recap.income, billed)} منها.`,
      };
    },
  },
  {
    id: 'treasury_balance',
    keywords: /رصيد|الخزينة|خزينة|كاش|نقد(ي|ية)?\s*(لدينا|المتوفر)?|البنك|بنكي|حساباتنا|السيولة|سيولة/,
    area: 'treasury',
    run: () => {
      const t = treasuryOverview();
      const live = t.accounts.filter((a: any) => a.status === 'ACTIVE');
      return {
        headline: `السيولة المتوفرة: ${money(t.total)}`,
        lines: [
          { label: 'الصندوق النقدي', value: money(t.cash_total) },
          { label: 'الحسابات البنكية والبريدية', value: money(t.bank_total) },
          { label: 'حسابات أخرى', value: money(t.other_total) },
          { label: 'عدد الحسابات النشطة', value: String(t.accounts_count) },
          ...(t.unassigned.count > 0
            ? [
              {
                label: 'حركات غير مخصّصة لحساب',
                value: `${money(t.unassigned.balance)} (${t.unassigned.count} حركة)`,
                tone: 'warn' as const,
              },
            ]
            : []),
        ],
        note: live.length
          ? `أكبر رصيد في «${[...live].sort((a: any, b: any) => b.balance - a.balance)[0].name_ar}».${
            t.unassigned.count > 0
              ? ' توجد حركات لم تُربط بحساب خزينة، ويُستحسن تخصيصها ليكون الرصيد دقيقاً.'
              : ''
          }`
          : 'لم تُسجَّل حسابات خزينة بعد — أضِف الصندوق والحسابات البنكية أولاً.',
      };
    },
  },
  {
    id: 'result',
    keywords: /النتيجة|ربح|خسارة|الفرق بين|صافي|هل نحن|الوضع المالي|الميزان/,
    area: 'overview',
    run: ({ recap, range }) => {
      const positive = recap.net >= 0;
      return {
        headline: `${positive ? 'ربح' : 'خسارة'} ${money(Math.abs(recap.net))} (${range.label})`,
        lines: [
          { label: 'المداخيل', value: money(recap.income), tone: 'good' },
          { label: 'المصروفات', value: money(recap.spending), tone: 'bad' },
          {
            label: 'النتيجة',
            value: `${positive ? '+' : '−'}${money(Math.abs(recap.net))}`,
            tone: positive ? 'good' : 'bad',
          },
          { label: 'هامش النتيجة', value: pct(Math.abs(recap.net), recap.income) },
        ],
        note: positive
          ? `المداخيل تغطي المصروفات بفارق ${money(recap.net)}.`
          : `المصروفات تجاوزت المداخيل بـ ${money(Math.abs(recap.net))} — راجع أكبر بنود الصرف في اليومية.`,
      };
    },
  },
  {
    id: 'income',
    keywords: /المداخيل|مداخيل|الإيرادات|إيراد|المحصّل|التحصيل|دخل|كم (حصّلنا|قبضنا)|القبض/,
    area: 'receipts',
    run: ({ recap, range, trip }) => ({
      headline: `المداخيل (${range.label}${trip ? ` · ${tripTypeLabel(trip)}` : ''}): ${money(recap.income)}`,
      lines: [
        { label: 'إجمالي المحصّل', value: money(recap.income), tone: 'good' },
        ...recap.collected_by_type
          .filter((t) => t.amount > 0)
          .map((t) => ({ label: `تحصيل ${t.label}`, value: money(t.amount) })),
        { label: 'عدد الحجوزات', value: String(recap.reservations_count) },
      ],
      note: `أعلى نشاط من حيث التحصيل: ${
        [...recap.collected_by_type].sort((a, b) => b.amount - a.amount)[0]?.label || '—'
      }.`,
    }),
  },
  {
    id: 'spending',
    keywords: /المصروفات|مصروف|النفقات|نفقات|الصرف|صرفنا|المشتريات|التكاليف|تكلفة/,
    area: 'ledger',
    run: ({ recap, range }) => ({
      headline: `المصروفات (${range.label}): ${money(recap.spending)}`,
      lines: [
        { label: 'إجمالي المصروفات', value: money(recap.spending), tone: 'bad' },
        ...recap.spending_by_category
          .slice(0, 5)
          .map((c) => ({ label: c.label, value: `${money(c.amount)} · ${pct(c.amount, recap.spending)}` })),
      ],
      note: recap.spending_by_category.length
        ? `أكبر بند صرف هو «${recap.spending_by_category[0].label}» ويمثل ${pct(
          recap.spending_by_category[0].amount,
          recap.spending
        )} من المصروفات.`
        : 'لا مصروفات مسجّلة في هذه الفترة.',
    }),
  },
  {
    id: 'supplier_debt',
    keywords: /الموردين|مورد|الموردون|فورنيسور|ندين|ديون(نا)?|الفواتير المتأخرة|نسدد|الدفع للمورد/,
    area: 'suppliers',
    run: ({ text }) => {
      const list = supplierStatusList();
      const open = list.filter((s) => s.total_remaining > 0);
      const overdue = list.filter((s) => s.settlement === 'OVERDUE');
      const dueSoon = list.filter((s) => s.settlement === 'DUE_SOON');
      const paid = list.filter((s) => s.settlement === 'PAID_FULL');
      const totalDebt = open.reduce((s, x) => s + x.total_remaining, 0);

      // "Who is overdue / due soon / fully paid" is a different question to "how much do we owe".
      if (/متأخر|تأخر|فات|تجاوز|استحق|قريب|يستحق|مواعيد|آجال|أجل/.test(text)) {
        return {
          headline: overdue.length
            ? `${overdue.length} مورد متأخر السداد بقيمة ${money(
              overdue.reduce((s, x) => s + x.overdue_amount, 0)
            )}`
            : 'لا يوجد أي مورد متأخر السداد',
          lines: [
            ...overdue.slice(0, 6).map((s) => ({
              label: `${s.name_ar} — تأخّر ${s.oldest_overdue_days} يوم`,
              value: money(s.overdue_amount),
              tone: 'bad' as const,
            })),
            ...dueSoon.slice(0, 6).map((s) => ({
              label: `${s.name_ar} — يستحق بعد ${s.days_to_next_due} يوم`,
              value: money(s.total_remaining),
              tone: 'warn' as const,
            })),
          ],
          note: dueSoon.length
            ? `${dueSoon.length} مورد يستحق خلال الأيام السبعة القادمة بقيمة ${money(
              dueSoon.reduce((s, x) => s + x.total_remaining, 0)
            )}.`
            : 'لا استحقاقات قريبة خلال سبعة أيام.',
        };
      }

      if (/خالص|مسدد|سدّدنا|دفعنا بالكامل|أنهينا/.test(text)) {
        return {
          headline: `${paid.length} مورد خالص بالكامل`,
          lines: paid.slice(0, 10).map((s) => ({
            label: `${s.name_ar} — ${s.invoice_count} فاتورة`,
            value: money(s.total_paid),
            tone: 'good' as const,
          })),
          note: paid.length
            ? 'هؤلاء الموردون لا توجد عليهم أرصدة مفتوحة.'
            : 'لا يوجد مورد سُدّدت كل فواتيره بعد.',
        };
      }

      return {
        headline: `دين الموردين: ${money(totalDebt)}`,
        lines: [
          { label: 'إجمالي الدين', value: money(totalDebt), tone: 'bad' },
          {
            label: 'منه متأخر السداد',
            value: money(open.reduce((s, x) => s + x.overdue_amount, 0)),
            tone: 'bad',
          },
          { label: 'فواتير مفتوحة', value: String(open.reduce((s, x) => s + x.open_count, 0)) },
          ...open.slice(0, 5).map((s) => ({
            label: `${s.name_ar} (${supplierCategoryLabel(s.category)})`,
            value: money(s.total_remaining),
          })),
        ],
        note: open.length
          ? `أكبر دائن هو «${open[0].name_ar}» بـ ${money(open[0].total_remaining)}، و${
            paid.length
          } مورد خالص بالكامل.`
          : 'لا أرصدة مفتوحة لدى الموردين.',
      };
    },
  },
  {
    id: 'client_debt',
    keywords: /العملاء|عميل|المعتمرين|معتمر|مستحقات|لنا عند|يدينون|متبقي على|الزبائن/,
    area: 'overview',
    run: ({ recap, range, trip }) => {
      const credits = clientAccountBalances().filter((c) => c.available > 0);
      return {
        headline: `مستحقات العملاء (${range.label}${trip ? ` · ${tripTypeLabel(trip)}` : ''}): ${money(
          recap.client_debt
        )}`,
        lines: [
          { label: 'إجمالي المستحقات', value: money(recap.client_debt), tone: 'warn' },
          { label: 'عدد الحجوزات', value: String(recap.reservations_count) },
          ...recap.client_rows.slice(0, 5).map((r) => ({
            label: `${r.name} — ${r.package_name || '—'}`,
            value: money(r.remaining),
          })),
          ...(credits.length
            ? [
              {
                label: 'أرصدة دائنة لعملاء (مدفوعة مسبقاً)',
                value: money(credits.reduce((s, c) => s + c.available, 0)),
                tone: 'good' as const,
              },
            ]
            : []),
        ],
        note: recap.client_rows.length
          ? `أعلى مستحق على «${recap.client_rows[0].name}» بـ ${money(recap.client_rows[0].remaining)}.`
          : 'لا مستحقات مفتوحة على العملاء في هذه الفترة.',
      };
    },
  },
  {
    id: 'payroll',
    keywords: /رواتب|راتب|الأجور|أجر|الموظفين|موظف|المستحقات الوظيفية|الأجراء/,
    area: 'payroll',
    run: ({ range }) => {
      const y = new Date().getUTCFullYear();
      const scoped =
        range.id === 'all'
          ? payrollByStaff()
          : range.id === 'month'
            ? payrollByStaff({
              from_year: y,
              from_month: new Date().getUTCMonth() + 1,
              to_year: y,
              to_month: new Date().getUTCMonth() + 1,
            })
            : payrollByStaff({ from_year: y, from_month: 1, to_year: y, to_month: 12 });
      const staff = scoped.staff || [];
      const pending = Number(scoped.pending_total) || 0;
      return {
        headline: `الرواتب (${range.label}): ${money(Number(scoped.total) || 0)}`,
        lines: [
          { label: 'المدفوع', value: money(Number(scoped.paid_total) || 0), tone: 'good' },
          { label: 'المعلّق', value: money(pending), tone: 'warn' },
          { label: 'عدد الموظفين', value: String(scoped.staff_count) },
          ...staff.slice(0, 5).map((s: any) => ({
            label: s.staff_name,
            value: money(Number(s.total) || 0),
          })),
        ],
        note:
          pending > 0
            ? `توجد رواتب معلّقة بقيمة ${money(pending)} تنتظر التسديد.`
            : 'كل رواتب الفترة مسدّدة.',
      };
    },
  },
  {
    id: 'assets',
    keywords: /استثمار|الأصول|أصل|التجهيزات|المعدات|السيارات|الحافلات|الشقق|الإهلاك|القيمة الدفترية/,
    area: 'assets',
    run: () => {
      const a = assetsSummary();
      const top = [...a.by_category].sort((x, y) => y.total_cost - x.total_cost);
      return {
        headline: `الاستثمارات: ${money(a.total_cost)} بتكلفة الشراء`,
        lines: [
          { label: 'القيمة الدفترية الصافية', value: money(a.net_book_value), tone: 'good' },
          { label: 'مجمّع الإهلاك', value: money(a.accumulated_depreciation), tone: 'warn' },
          { label: 'عدد الأصول', value: `${a.count} (${a.active_count} نشط)` },
          ...top.slice(0, 5).map((c) => ({
            label: `${assetCategoryLabel(c.id)} × ${c.quantity}`,
            value: money(c.total_cost),
          })),
        ],
        note: top.length
          ? `أكبر تصنيف استثماري هو «${assetCategoryLabel(top[0].id)}» ويمثل ${pct(
            top[0].total_cost,
            a.total_cost
          )} من إجمالي التكلفة، والقيمة الدفترية تساوي ${pct(a.net_book_value, a.total_cost)} من التكلفة.`
          : 'لم تُسجَّل أصول بعد.',
      };
    },
  },
  {
    id: 'journal',
    keywords: /اليومية|يومية|مدين|دائن|القيود|قيد|الدفتر|سجل الحركات|حركة اليوم/,
    area: 'ledger',
    run: ({ range }) => {
      const j = dailyJournal({ from: range.from, to: range.to }) as any;
      const days = j.days || [];
      return {
        headline: `حركة ${range.label}: مدين ${money(j.total_debit)} · دائن ${money(j.total_credit)}`,
        lines: [
          { label: 'رصيد افتتاحي', value: money(j.opening) },
          { label: 'إجمالي المدين', value: money(j.total_debit), tone: 'good' },
          { label: 'إجمالي الدائن', value: money(j.total_credit), tone: 'bad' },
          {
            label: 'حركة الفترة',
            value: `${j.net >= 0 ? '+' : '−'}${money(Math.abs(j.net))}`,
            tone: j.net >= 0 ? 'good' : 'bad',
          },
          { label: 'رصيد ختامي', value: money(j.closing) },
          { label: 'عدد الأيام ذات الحركة', value: String(days.length) },
        ],
        note: days.length
          ? `أكثر يوم حركةً هو ${
            [...days].sort((a: any, b: any) => b.debit + b.credit - (a.debit + a.credit))[0].date
          }.`
          : 'لا قيود مسجّلة في هذه الفترة.',
      };
    },
  },
];

/** Curated prompts, grouped the way the dashboard is laid out. */
export const FAMOUS_QUESTIONS: { area: FinanceArea; label: string; questions: string[] }[] = [
  {
    area: 'overview',
    label: 'الملخص والنتيجة',
    questions: [
      'هل نحن في ربح أم خسارة هذا الشهر؟',
      'ما الفرق بين مستحقات العملاء ودين الموردين؟',
      'قارن التحصيل والمستحقات حسب النشاط',
      'كم لنا عند العملاء من مستحقات؟',
    ],
  },
  {
    area: 'treasury',
    label: 'الخزينة',
    questions: ['ما رصيد الخزينة الآن؟', 'كم لدينا نقداً وكم في البنك؟'],
  },
  {
    area: 'ledger',
    label: 'اليومية والمصروفات',
    questions: [
      'ما حركة اليومية هذا الشهر مدين ودائن؟',
      'ما إجمالي المصروفات هذا الشهر؟',
      'ما أكبر بنود الصرف هذه السنة؟',
    ],
  },
  {
    area: 'receipts',
    label: 'المداخيل',
    questions: [
      'ما إجمالي المداخيل هذا الشهر؟',
      'ما نسبة التحصيل هذه السنة؟',
      'كم حصّلنا من العمرة هذه السنة؟',
      'كم حصّلنا من الحج هذه السنة؟',
    ],
  },
  {
    area: 'suppliers',
    label: 'الموردون',
    questions: [
      'كم ندين للموردين؟',
      'من هم الموردون المتأخرون أو الذين يستحقون قريباً؟',
      'من هم الموردون الخالصون بالكامل؟',
    ],
  },
  {
    area: 'payroll',
    label: 'الرواتب',
    questions: ['ما إجمالي الرواتب هذه السنة؟', 'هل توجد رواتب معلّقة؟'],
  },
  {
    area: 'assets',
    label: 'الاستثمارات',
    questions: ['ما قيمة الاستثمارات والقيمة الدفترية؟', 'ما أكبر تصنيف استثماري لدينا؟'],
  },
];

/**
 * Answer one finance question against live data. `period` / `tripType` act as the
 * dashboard filter; anything stated inside the question itself overrides them, so
 * "كم حصّلنا من الحج هذه السنة" filters even when the panel is set to this month.
 */
export function answerFinanceQuestion(input: {
  question: string;
  period?: FinancePeriodId;
  tripType?: string | null;
}): FinanceAnswer {
  const question = String(input.question || '').trim();
  const text = question.replace(/[؟?.,!]/g, ' ');

  const range = resolvePeriod(periodFromText(text) || input.period || 'month');
  const trip = tripFromText(text) || input.tripType || null;
  const recap = financeRecap({ from: range.from, to: range.to, tripType: trip || undefined });
  const ctx: Ctx = { text, range, trip, recap };

  const hit = INTENTS.find((i) => i.keywords.test(text));
  if (!hit) {
    return {
      intent: 'unknown',
      question,
      matched: false,
      headline: 'لم أفهم السؤال بدقة كافية للإجابة بأرقام مؤكدة',
      lines: [
        { label: 'المداخيل', value: money(recap.income) },
        { label: 'المصروفات', value: money(recap.spending) },
        { label: 'النتيجة', value: money(recap.net), tone: recap.net >= 0 ? 'good' : 'bad' },
        { label: 'دين الموردين', value: money(recap.supplier_debt) },
        { label: 'مستحقات العملاء', value: money(recap.client_debt) },
      ],
      note: 'اختر أحد الأسئلة الجاهزة، أو اسأل عن: الخزينة، المداخيل، المصروفات، النتيجة، الموردين، العملاء، الرواتب، الاستثمارات، اليومية.',
      area: 'overview',
      period: { id: range.id, label: range.label },
      trip_type: trip,
    };
  }

  const body = hit.run(ctx);
  return {
    intent: hit.id,
    question,
    matched: true,
    area: hit.area,
    period: { id: range.id, label: range.label },
    trip_type: trip,
    ...body,
    lines: body.lines.filter((l) => l.value && l.value !== '—'),
  };
}

/** One-screen brief of the whole dashboard, used as Sakhr's opening context. */
export function financeBrief(period: FinancePeriodId = 'month') {
  const range = resolvePeriod(period);
  const recap = financeRecap({ from: range.from, to: range.to });
  const suppliers = supplierStatusList();
  return {
    period: { id: range.id, label: range.label },
    income: recap.income,
    spending: recap.spending,
    net: recap.net,
    treasury_total: recap.treasury.total,
    client_debt: recap.client_debt,
    supplier_debt: recap.supplier_debt,
    assets_cost: recap.assets.total_cost,
    overdue_suppliers: suppliers.filter((s) => s.settlement === 'OVERDUE').length,
    due_soon_suppliers: suppliers.filter((s) => s.settlement === 'DUE_SOON').length,
    paid_suppliers: suppliers.filter((s) => s.settlement === 'PAID_FULL').length,
    top_spending: recap.spending_by_category
      .slice(0, 3)
      .map((c) => ({ label: ledgerCategoryLabel(c.id), amount: c.amount })),
  };
}

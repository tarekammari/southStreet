/**
 * Official SCF cash-flow statement, direct method
 * (JORADP n°19 — جدول سيولة الخزينة). Lines the agency does not track stay at zero.
 */

export type OfficialCashFlowRow = {
  id: string;
  label: string;
  kind: 'section' | 'line' | 'total';
  /** Signed: inflows positive, outflows negative. Omitted on section headers. */
  amount?: number;
  /** Existing treasury drill-down id, when the whole line is one flow. */
  flowId?: string;
};

export function buildOfficialCashFlow(input: {
  clientIn?: number;
  supplierOut?: number;
  payrollOut?: number;
  serviceOut?: number;
  otherOut?: number;
  opening?: number;
  closing?: number;
}): OfficialCashFlowRow[] {
  const collections = Number(input.clientIn) || 0;
  const paidToSuppliersAndStaff =
    (Number(input.supplierOut) || 0) +
    (Number(input.payrollOut) || 0) +
    (Number(input.serviceOut) || 0) +
    (Number(input.otherOut) || 0);
  const interestPaid = 0;
  const taxPaid = 0;
  const beforeExtraordinary = collections - paidToSuppliersAndStaff - interestPaid - taxPaid;
  const extraordinary = 0;
  const operating = beforeExtraordinary + extraordinary;
  const investing = 0;
  const financing = 0;
  const fx = 0;
  const changeAbc = operating + investing + financing + fx;
  const opening = Number(input.opening) || 0;
  const closing = input.closing != null ? Number(input.closing) || 0 : opening + changeAbc;
  const changeInPeriod = closing - opening;

  const section = (id: string, label: string): OfficialCashFlowRow => ({ id, label, kind: 'section' });
  const line = (id: string, label: string, amount: number, flowId?: string): OfficialCashFlowRow => ({
    id,
    label,
    kind: 'line',
    amount,
    flowId,
  });
  const total = (id: string, label: string, amount: number): OfficialCashFlowRow => ({
    id,
    label,
    kind: 'total',
    amount,
  });

  return [
    section('op_head', 'تدفقات أموال الخزينة المتأتية من الأنشطة العملياتية'),
    line('clients', 'التحصيلات المقبوضة من عند الزبائن', collections, 'client_in'),
    line('suppliers_staff', 'المبالغ المدفوعة للموردين والمستخدمين', -paidToSuppliersAndStaff),
    line('interest_paid', 'الفوائد والمصاريف المالية الأخرى المدفوعة', -interestPaid),
    line('tax_paid', 'الضرائب عن النتائج المدفوعة', -taxPaid),
    total('before_extra', 'تدفقات أموال الخزينة قبل العناصر غير العادية', beforeExtraordinary),
    line('extraordinary', 'تدفقات أموال الخزينة المرتبطة بالعناصر غير العادية', extraordinary),
    total('A', 'صافي تدفقات أموال الخزينة المتأتية من الأنشطة العملياتية (أ)', operating),

    section('inv_head', 'تدفقات أموال الخزينة المتأتية من أنشطة الاستثمار'),
    line('buy_tangible', 'المسحوبات عن اقتناء تثبيتات عينية أو معنوية', 0),
    line('sell_tangible', 'التحصيلات عن عمليات التنازل عن تثبيتات عينية أو معنوية', 0),
    line('buy_financial', 'المسحوبات عن اقتناء تثبيتات مالية', 0),
    line('sell_financial', 'التحصيلات عن عمليات التنازل عن تثبيتات مالية', 0),
    line('interest_received', 'الفوائد التي تم تحصيلها من التوظيفات المالية', 0),
    line('dividends_in', 'الحصص والأقساط المقبوضة من النتائج المستلمة', 0),
    total('B', 'صافي تدفقات أموال الخزينة المتأتية من أنشطة الاستثمار (ب)', investing),

    section('fin_head', 'تدفقات أموال الخزينة المتأتية من أنشطة التمويل'),
    line('share_issue', 'التحصيلات في أعقاب إصدار أسهم', 0),
    line('dividends_out', 'الحصص وغيرها من التوزيعات التي تم القيام بها', 0),
    line('loans_in', 'التحصيلات المتأتية من القروض', 0),
    line('loans_out', 'تسديدات القروض أو الديون الأخرى المماثلة', 0),
    total('C', 'صافي تدفقات أموال الخزينة المتأتية من أنشطة التمويل (ج)', financing),

    line('fx', 'تأثيرات تغيرات سعر الصرف على السيولات وشبه السيولات', fx),
    total('ABC', 'تغير أموال الخزينة في الفترة (أ + ب + ج)', changeAbc),
    line('opening', 'أموال الخزينة ومعادلاتها عند افتتاح السنة المالية', opening),
    line('closing', 'أموال الخزينة ومعادلاتها عند إقفال السنة المالية', closing),
    total('delta', 'تغير أموال الخزينة خلال الفترة', changeInPeriod),
    section('bridge', 'المقاربة مع النتيجة المحاسبية'),
  ];
}

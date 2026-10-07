/**
 * Official SCF income statement by nature (JORADP n°19 — 25 mars 2009).
 * Account numbers match «حساب النتائج (حسب الطبيعة)». Amounts the agency
 * tracks are posted on the matching line; other lines stay at zero.
 */

export type OfficialResultatRow = {
  id: string;
  label: string;
  accounts: string;
  amount: number;
  kind: 'line' | 'total';
  /** in = product, out = charge, result = calculated subtotal. */
  tone: 'in' | 'out' | 'result';
  section?: string;
};

type ChargeLike = { amount: number; scf_code?: string };
type ProductLike = { amount: number; scf_code?: string };

function prefix2(code?: string) {
  const m = String(code || '').trim().match(/^(\d{2})/);
  return m ? m[1] : '';
}

function sum(lines: { amount: number }[]) {
  return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
}

export function buildOfficialResultat(input: {
  products?: ProductLike[];
  charges?: ChargeLike[];
  total_products?: number;
  total_charges?: number;
  result?: number;
}): OfficialResultatRow[] {
  const products = input.products || [];
  const charges = input.charges || [];

  const productBucket = (code?: string) => {
    const p = prefix2(code);
    if (p === '72' || p === '73' || p === '74' || p === '75' || p === '76' || p === '77' || p === '78') return p;
    return '70';
  };
  const chargeBucket = (code?: string) => {
    const raw = String(code || '').trim();
    if (raw.startsWith('692') || raw.startsWith('693')) return 'deferred';
    if (raw.startsWith('69')) return 'tax';
    const p = prefix2(raw);
    if (p === '60') return '60';
    if (p === '61' || p === '62') return '6162';
    if (p === '63' || p === '64' || p === '65' || p === '66' || p === '67' || p === '68') return p;
    return '65';
  };

  const pAmt: Record<string, number> = {};
  if (products.length) {
    for (const row of products) {
      const key = productBucket(row.scf_code);
      pAmt[key] = (pAmt[key] || 0) + (Number(row.amount) || 0);
    }
  } else if (input.total_products) {
    pAmt['70'] = input.total_products;
  }

  const cAmt: Record<string, number> = {};
  for (const row of charges) {
    const key = chargeBucket(row.scf_code);
    cAmt[key] = (cAmt[key] || 0) + (Number(row.amount) || 0);
  }
  const mappedCharges = sum(charges);
  const statedCharges = input.total_charges ?? mappedCharges;
  if (statedCharges > mappedCharges + 0.01) {
    cAmt['65'] = (cAmt['65'] || 0) + (statedCharges - mappedCharges);
  }

  const a70 = pAmt['70'] || 0;
  const a72 = pAmt['72'] || 0;
  const a73 = pAmt['73'] || 0;
  const a74 = pAmt['74'] || 0;
  const a75 = pAmt['75'] || 0;
  const a76 = pAmt['76'] || 0;
  const a77 = pAmt['77'] || 0;
  const a78 = pAmt['78'] || 0;

  const c60 = cAmt['60'] || 0;
  const c6162 = cAmt['6162'] || 0;
  const c63 = cAmt['63'] || 0;
  const c64 = cAmt['64'] || 0;
  const c65 = cAmt['65'] || 0;
  const c66 = cAmt['66'] || 0;
  const c67 = cAmt['67'] || 0;
  const c68 = cAmt['68'] || 0;
  const tax = cAmt['tax'] || 0;
  const deferred = cAmt['deferred'] || 0;

  const I = a70 + a72 + a73 + a74;
  const II = c60 + c6162;
  const III = I - II;
  const IV = III - c63 - c64;
  const V = IV + a75 - c65 - c68 + a78;
  const VI = a76 - c66;
  const VII = V + VI;
  const ordinaryProducts = I + a75 + a76 + a78;
  const ordinaryCharges = II + c63 + c64 + c65 + c66 + c68 + tax + deferred;
  const VIII = VII - tax - deferred;
  const IX = a77 - c67;
  const X = VIII + IX;

  const line = (
    id: string,
    label: string,
    accounts: string,
    amount: number,
    tone: OfficialResultatRow['tone'],
    kind: OfficialResultatRow['kind'] = 'line',
    section?: string
  ): OfficialResultatRow => ({ id, label, accounts, amount, tone, kind, section });

  return [
    line('sales', 'المبيعات والمنتوجات الملحقة', '70', a70, 'in', 'line', 'receipts'),
    line('inventory_change', 'تغيرات المخزونات المصنعة والمنتجات قيد الصنع', '72', a72, 'in'),
    line('capitalized', 'الإنتاج المثبت', '73', a73, 'in'),
    line('subsidies', 'إعانات الاستغلال', '74', a74, 'in'),
    line('I', 'إنتاج السنة المالية', 'I', I, 'result', 'total'),
    line('purchases', 'المشتريات المستهلكة', '60', c60, 'out', 'line', 'suppliers'),
    line('external', 'الخدمات الخارجية والاستهلاكات الأخرى', '61 و 62', c6162, 'out', 'line', 'suppliers'),
    line('II', 'استهلاك السنة المالية', 'II', II, 'result', 'total'),
    line('III', 'القيمة المضافة للاستغلال', 'I − II', III, 'result', 'total'),
    line('personnel', 'أعباء المستخدمين', '63', c63, 'out', 'line', 'payroll'),
    line('duties', 'الضرائب والرسوم والمدفوعات المماثلة', '64', c64, 'out'),
    line('IV', 'إجمالي فائض الاستغلال', 'IV', IV, 'result', 'total'),
    line('other_op_in', 'المنتجات العملياتية الأخرى', '75', a75, 'in'),
    line('other_op_out', 'الأعباء العملياتية الأخرى', '65', c65, 'out'),
    line('depreciation', 'المخصصات للاهتلاكات والمؤونات وخسائر القيمة', '68', c68, 'out', 'line', 'assets'),
    line('reversals', 'استرجاع على خسائر القيمة والمؤونات', '78', a78, 'in'),
    line('V', 'النتيجة العملياتية', 'V', V, 'result', 'total'),
    line('fin_in', 'المنتوجات المالية', '76', a76, 'in'),
    line('fin_out', 'الأعباء المالية', '66', c66, 'out'),
    line('VI', 'النتيجة المالية', 'VI', VI, 'result', 'total'),
    line('VII', 'النتيجة العادية قبل الضرائب', 'V + VI', VII, 'result', 'total'),
    line('tax', 'الضرائب الواجب دفعها عن النتائج العادية', '695 و 698', tax, 'out'),
    line('deferred', 'الضرائب المؤجلة (تغيرات) عن النتائج العادية', '692 و 693', deferred, 'out'),
    line('ord_products', 'مجموع منتجات الأنشطة العادية', '', ordinaryProducts, 'result', 'total'),
    line('ord_charges', 'مجموع أعباء الأنشطة العادية', '', ordinaryCharges, 'result', 'total'),
    line('VIII', 'النتيجة الصافية للأنشطة العادية', 'VIII', VIII, 'result', 'total'),
    line('extra_in', 'العناصر غير العادية — منتجات', '77', a77, 'in'),
    line('extra_out', 'العناصر غير العادية — أعباء', '67', c67, 'out'),
    line('IX', 'النتيجة غير العادية', 'IX', IX, 'result', 'total'),
    line('X', 'صافي نتيجة السنة المالية', 'X', X, 'result', 'total'),
  ];
}

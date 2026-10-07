export type TaxBucketId = 'activity' | 'gov' | 'result';

export const TAX_BUCKETS: { id: TaxBucketId; code: string; label: string; note: string }[] = [
  { id: 'activity', code: '64', label: 'ضرائب ورسوم', note: 'على النشاط' },
  { id: 'gov', code: '447', label: 'رسوم حكومية', note: 'طوابع ورسوم الإدارة' },
  { id: 'result', code: '695', label: 'ضرائب على النتائج', note: 'IBS وما يلحقها' },
];

export function taxBucketOf(row: {
  scf_code?: string | null;
  description?: string | null;
  counterparty?: string | null;
  category?: string | null;
}): TaxBucketId | null {
  const code = String(row.scf_code || '').replace(/\s/g, '');
  const blob = `${row.description || ''} ${row.counterparty || ''} ${row.category || ''}`.toLowerCase();
  if (code.startsWith('69') || /ibs|ضريبة على النتائج|ضريبة الدخل/.test(blob)) return 'result';
  if (row.category === 'gov_fees' || code.startsWith('447') || /رسم|طابع|حكوم/.test(blob)) return 'gov';
  if (code.startsWith('64') || /tva|ضريبة|irg|tap|اقتطاع/.test(blob)) return 'activity';
  return null;
}

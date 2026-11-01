/**
 * Visa follow-up for tourist trips (the agency handles visas). Stored on the
 * reservation (visa_status, visa_note); staff move it forward, the client
 * sees where it stands. Shared by server and browser.
 */

export type VisaStatus = 'DOCS_NEEDED' | 'DOCS_RECEIVED' | 'SUBMITTED' | 'APPROVED' | 'REFUSED' | 'NOT_REQUIRED';

export const VISA_STEPS: { id: VisaStatus; label: string; hint: string }[] = [
  { id: 'DOCS_NEEDED', label: 'الوثائق مطلوبة', hint: 'أرسل جواز السفر والصورة وباقي الوثائق للوكالة.' },
  { id: 'DOCS_RECEIVED', label: 'استلمنا الوثائق', hint: 'الوكالة تراجع ملفك وتجهّزه.' },
  { id: 'SUBMITTED', label: 'الملف مودَع', hint: 'أُودع طلب التأشيرة — ننتظر الرد.' },
  { id: 'APPROVED', label: 'التأشيرة مقبولة', hint: 'تأشيرتك جاهزة.' },
];

export const VISA_LABEL: Record<VisaStatus, string> = {
  DOCS_NEEDED: 'الوثائق مطلوبة',
  DOCS_RECEIVED: 'استلمنا الوثائق',
  SUBMITTED: 'الملف مودَع',
  APPROVED: 'التأشيرة مقبولة',
  REFUSED: 'التأشيرة مرفوضة',
  NOT_REQUIRED: 'لا تحتاج تأشيرة',
};

export const VISA_STATUSES = Object.keys(VISA_LABEL) as VisaStatus[];

export function visaStatusOf(v?: string | null): VisaStatus {
  return VISA_STATUSES.includes(v as VisaStatus) ? (v as VisaStatus) : 'DOCS_NEEDED';
}

export function visaTone(s: VisaStatus): 'good' | 'bad' | 'wait' {
  return s === 'APPROVED' || s === 'NOT_REQUIRED' ? 'good' : s === 'REFUSED' ? 'bad' : 'wait';
}

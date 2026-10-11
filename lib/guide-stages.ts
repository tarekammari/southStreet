/** Check-in stages a guide ticks for each booking of his group (shared by the page and the API). */
export const GUIDE_STAGES = [
  { id: 'airport', label: 'التجمع في المطار' },
  { id: 'makkah', label: 'الوصول إلى فندق مكة' },
  { id: 'umrah', label: 'أداء العمرة' },
  { id: 'madinah', label: 'الانتقال إلى المدينة' },
  { id: 'return', label: 'العودة' },
] as const;

export type GuideStageId = (typeof GUIDE_STAGES)[number]['id'];

export const isGuideStage = (v: unknown): v is GuideStageId => GUIDE_STAGES.some((s) => s.id === v);

export type PageContentRow = {
  key: string;
  section: string;
  title_ar?: string | null;
  title_fr?: string | null;
  title_en?: string | null;
  content_ar?: string | null;
  content_fr?: string | null;
  content_en?: string | null;
  image_url?: string | null;
  updated_at?: string | null;
};

export const PAGE_CONTENT_LABELS: Record<string, string> = {
  hero_banner: 'بانر الصفحة الرئيسية',
  nav_promo: 'شريط العرض في الأعلى',
  about_section: 'قسم الطاقم والوكالة',
  programs_section: 'قسم برامج السفر',
  promo_billboard: 'لوحة الطيران المباشر',
  footer_newsletter: 'نشرة تذييل الصفحة',
};

export const PAGE_CONTENT_SECTIONS: { id: string; label: string }[] = [
  { id: 'homepage', label: 'الصفحة الرئيسية' },
  { id: 'footer', label: 'تذييل الموقع' },
  { id: 'packages', label: 'صفحة الباقات' },
  { id: 'hotels', label: 'صفحة الفنادق' },
  { id: 'general', label: 'عام' },
];

export function pickPageContent(
  rows: PageContentRow[] | undefined,
  key: string,
  fallback: { title: string; content?: string; image?: string }
) {
  const row = rows?.find((r) => r.key === key);
  const title = (row?.title_ar || '').trim();
  const content = (row?.content_ar || '').trim();
  const image = (row?.image_url || '').trim();
  return {
    title: title || fallback.title,
    content: content || fallback.content || '',
    image: image || fallback.image || '',
  };
}

/**
 * Complete application sitemap — single source of truth for Sakhr AI navigation & content discovery.
 */

export interface AppSection {
  id: string;
  title: string;
  titleEn?: string;
  description: string;
  anchor?: string;
  keywords: string[];
}

export interface AppPage {
  id: string;
  path: string;
  title: string;
  titleEn?: string;
  description: string;
  keywords: string[];
  sections?: AppSection[];
  requiresAuth?: boolean;
  adminOnly?: boolean;
}

export const APP_PAGES: AppPage[] = [
  {
    id: 'home',
    path: '/',
    title: 'الصفحة الرئيسية',
    titleEn: 'Home',
    description: 'واجهة وكالة ساوث ستريت — عروض العمرة، طاقم المرشدين، برامج السفر، والتواصل المباشر.',
    keywords: ['الرئيسية', 'الصفحة الرئيسية', 'home', 'البداية', 'الواجهة', 'افتح الرئيسية', 'خذني للرئيسية'],
    sections: [
      {
        id: 'hero',
        title: 'قسم البطل — عروض العمرة',
        description: 'عرض رحلة أوت 2026 المميزة ابتداءً من 215,000 دج مع طيران مباشر وإقامة فاخرة.',
        anchor: '#hero-section',
        keywords: ['البطل', 'hero', 'العرض', '215000', 'أوت', 'احجز الآن', 'الكعبة'],
      },
      {
        id: 'agency',
        title: 'معرض الوكالة',
        description: 'عرض مصور لخدمات الوكالة: فنادق، مرشدين، وجبات، روضة، طيران، حافلات، تأشيرات.',
        anchor: '#agency-section',
        keywords: ['معرض', 'الوكالة', 'خدمات', 'صور', 'slideshow', 'gallery'],
      },
      {
        id: 'promo',
        title: 'عرض الطيران المباشر',
        description: 'بانر رحلة طيران مباشرة إلى البقاع المقدسة عبر Air Algérie.',
        anchor: '#promo-section',
        keywords: ['طيران', 'air algeria', 'الخطوط', 'مباشر', 'عرض الطيران'],
      },
      {
        id: 'about',
        title: 'عن الوكالة — طاقم العمل',
        description: 'تعرف على المرشدين الدينيين، المرشدات، وطاقم الإدارة والعمليات.',
        anchor: '#about-section',
        keywords: ['عن الوكالة', 'من نحن', 'طاقم', 'مرشد', 'مرشدة', 'فريق', 'about', 'staff', 'team'],
      },
      {
        id: 'programs',
        title: 'برامج السفر',
        description: 'برامج العمرة المتاحة للحجز ورحلات التسجيل المسبق القادمة.',
        anchor: '#programs-section',
        keywords: ['البرامج', 'برامج', 'programs', 'رحلات', 'عمرة أغسطس', 'المولد', 'حج 2027'],
      },
      {
        id: 'contact',
        title: 'التواصل',
        description: 'معلومات الاتصال، البريد الإلكتروني، الهاتف، وروابط سريعة.',
        anchor: '#contact',
        keywords: ['تواصل', 'contact', 'هاتف', 'بريد', 'اتصل', 'رقم'],
      },
    ],
  },
  {
    id: 'packages',
    path: '/packages',
    title: 'صفحة الباقات',
    titleEn: 'Packages',
    description: 'كتالوج باقات العمرة والحج 2026 مع الأسعار، الفنادق، والمقاعد المتاحة — مباشرة من قاعدة البيانات.',
    keywords: ['باقات', 'باقة', 'packages', 'عروض', 'أسعار', 'حجز', 'عرض الباقات', 'صفحة الباقات', 'برامج العمرة'],
  },
  {
    id: 'hotels',
    path: '/hotels',
    title: 'صفحة الفنادق',
    titleEn: 'Hotels',
    description: 'فنادق مكة المكرمة والمدينة المنورة المعتمدة مع المسافات من الحرم والخدمات.',
    keywords: ['فنادق', 'فندق', 'hotels', 'مكة', 'المدينة', 'سويس', 'منارات', 'إقامة', 'صفحة الفنادق'],
  },
  {
    id: 'portal',
    path: '/portal',
    title: 'بوابة المعتمرين',
    titleEn: 'Portal',
    description: 'لوحة تحكم المعتمر، المرشد، والمحاسب — حجوزات، وثائق، سندات، مناسك، ومحادثة.',
    keywords: ['بوابة', 'portal', 'حسابي', 'حجوزاتي', 'معتمر', 'لوحة التحكم'],
    requiresAuth: true,
    sections: [
      { id: 'rituals', title: 'دليل المناسك', description: 'عداد الطواف والسعي التفاعلي مع الأدعية.', keywords: ['مناسك', 'طواف', 'سعي', 'rituals', 'دليل العمرة'], anchor: '?tab=rituals' },
      { id: 'chat', title: 'المحادثة', description: 'غرفة التواصل المشفرة مع المرشد والفوج.', keywords: ['شات', 'chat', 'محادثة', 'مراسلة'], anchor: '?tab=chat' },
      { id: 'reservations', title: 'الحجوزات', description: 'متابعة حجوزات الرحلات والوثائق.', keywords: ['حجز', 'reservations', 'وثائق'], anchor: '?tab=reservations' },
      { id: 'payments', title: 'المدفوعات', description: 'سندات القبض وجدول الأقساط.', keywords: ['دفع', 'payments', 'سند', 'أقساط'], anchor: '?tab=payments' },
    ],
  },
  {
    id: 'admin',
    path: '/admin',
    title: 'لوحة الإدارة',
    titleEn: 'Admin Dashboard',
    description: 'إدارة الباقات، الفنادق، المرشدين، المستخدمين، وقواعد معرفة صخر AI.',
    keywords: ['ادارة', 'إدارة', 'admin', 'لوحة التحكم', 'لوحة الادارة', 'cms', 'مدير'],
    adminOnly: true,
  },
];

/** Score-based search across pages and sections */
export function searchAppContent(query: string, topK = 5): Array<{ type: 'page' | 'section'; page: AppPage; section?: AppSection; score: number }> {
  const lower = query.toLowerCase().trim();
  const results: Array<{ type: 'page' | 'section'; page: AppPage; section?: AppSection; score: number }> = [];

  for (const page of APP_PAGES) {
    let pageScore = 0;
    if (lower.includes(page.title.toLowerCase())) pageScore += 30;
    if (page.titleEn && lower.includes(page.titleEn.toLowerCase())) pageScore += 25;
    for (const kw of page.keywords) {
      if (lower.includes(kw.toLowerCase())) pageScore += 12 + kw.length;
    }
    for (const word of lower.split(/\s+/).filter(w => w.length > 2)) {
      if (page.description.includes(word)) pageScore += 5;
    }
    if (pageScore > 0) results.push({ type: 'page', page, score: pageScore });

    for (const section of page.sections || []) {
      let secScore = 0;
      if (lower.includes(section.title.toLowerCase())) secScore += 35;
      for (const kw of section.keywords) {
        if (lower.includes(kw.toLowerCase())) secScore += 15 + kw.length;
      }
      if (secScore > 0) results.push({ type: 'section', page, section, score: secScore });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}

/** Find best navigation target for user request */
export function resolveNavigationTarget(query: string): { path: string; label: string; description: string } | null {
  const results = searchAppContent(query, 1);
  if (!results.length || results[0].score < 10) return null;

  const { type, page, section } = results[0];
  if (type === 'section' && section) {
    const anchor = section.anchor || '';
    const path = anchor.startsWith('?') ? `${page.path}${anchor}` : `${page.path}${anchor}`;
    return { path, label: section.title, description: section.description };
  }
  return { path: page.path, label: page.title, description: page.description };
}

/** Build compact sitemap text for LLM context */
export function buildSitemapContext(): string {
  return APP_PAGES.map(p => {
    const secs = (p.sections || []).map(s => `  • ${s.title}: ${s.description}`).join('\n');
    return `- ${p.title} (${p.path}): ${p.description}${secs ? '\n' + secs : ''}`;
  }).join('\n');
}

/** List all pages and sections for "what can you show me" queries */
export function getFullSiteInventory() {
  return APP_PAGES.map(p => ({
    id: p.id,
    path: p.path,
    title: p.title,
    description: p.description,
    sections: (p.sections || []).map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      target: s.anchor ? `${p.path}${s.anchor}` : p.path,
    })),
  }));
}

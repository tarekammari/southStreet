/**
 * Content of the public "عن الوكالة" page (/about), edited by admins in the
 * dashboard (components/admin/AboutPageEditor). Stored as page_content rows:
 *
 *   about_hero      title_ar, content_ar, image_url
 *   about_story     title_ar, content_ar, image_url
 *   about_values    title_ar = heading, content_ar = JSON [{ title, text }]
 *   about_journey   title_ar = heading, content_ar = JSON [{ title, text }]
 *   about_gallery   title_ar = heading, content_ar = JSON [{ url, caption }]
 *   about_settings  content_ar = JSON { stats, team, reviews }
 *
 * Every field falls back to the defaults below, so the page is complete even
 * before anything is edited.
 */
import type { PageContentRow } from './page-content';

export type AboutItem = { title: string; text: string };
export type AboutPhoto = { url: string; caption: string };
export type AboutSettings = { stats: boolean; team: boolean; reviews: boolean };

export type AboutContent = {
  hero: { title: string; text: string; image: string };
  story: { title: string; text: string; image: string };
  values: { heading: string; items: AboutItem[] };
  journey: { heading: string; items: AboutItem[] };
  gallery: { heading: string; items: AboutPhoto[] };
  settings: AboutSettings;
};

export const ABOUT_KEYS = ['about_hero', 'about_story', 'about_values', 'about_journey', 'about_gallery', 'about_settings'] as const;

export const ABOUT_DEFAULTS: AboutContent = {
  hero: {
    title: 'رفيقكم الأمين في رحلة العمر',
    text: 'وكالة سياحة وأسفار متخصصة في رحلات العمرة والحج، نرافقكم من لحظة اختيار البرنامج حتى عودتكم سالمين، بتنظيم واضح ومرافقة دينية متخصصة.',
    image: '/images/maka01.webp',
  },
  story: {
    title: 'من نحن',
    text:
      'نؤمن أن رحلة العمرة ليست سفراً عادياً، بل لحظة ينتظرها المسلم طويلاً. لذلك نهتم بكل تفصيلة: اختيار الفندق، وتنظيم التنقلات، ومرافقة المرشد، وتيسير الوثائق، حتى تتفرغوا للعبادة بقلب مطمئن.\n\nفريقنا يجمع إداريين ومرشدين ومرشدات ذوي خبرة، يعملون معاً ليكون كل معتمر في أيدٍ أمينة من الجزائر إلى الحرمين الشريفين.',
    image: '/images/section2_03.webp',
  },
  values: {
    heading: 'ما يميّز رحلتكم معنا',
    items: [
      { title: 'مرافقة دينية متخصصة', text: 'مرشدون ومرشدات يرافقونكم في المناسك خطوة بخطوة، ويجيبون عن أسئلتكم طوال الرحلة.' },
      { title: 'فنادق قريبة من الحرم', text: 'نختار فنادق موثوقة في مكة المكرمة والمدينة المنورة، مع توضيح المسافة والخدمات لكل فندق.' },
      { title: 'أسعار واضحة', text: 'سعر كل برنامج ونوع غرفة معروض بوضوح، وتحصلون على وصل وفاتورة لكل دفعة.' },
      { title: 'متابعة قبل وأثناء الرحلة', text: 'نتابع وثائقكم وتأشيرتكم وحالة حجزكم، وتصلكم كل التحديثات في بوابتكم الخاصة.' },
    ],
  },
  journey: {
    heading: 'من الحجز إلى العودة',
    items: [
      { title: 'اختر برنامجك', text: 'تصفح البرامج المتاحة وقارن التواريخ والفنادق والأسعار.' },
      { title: 'أرسل طلب الحجز', text: 'املأ طلبك عبر الموقع في دقائق، أو اطلب المساعدة من صخر.' },
      { title: 'التأكيد والوثائق', text: 'تراجع الوكالة طلبك، وتتابع معك الوثائق والتأشيرة والدفع.' },
      { title: 'السفر مع المرشد', text: 'رحلة منظمة من المطار إلى الفندق مع مرافقة في أداء المناسك.' },
      { title: 'العودة والتقييم', text: 'شاركنا تجربتك لتساعد المعتمرين القادمين في اختيارهم.' },
    ],
  },
  gallery: { heading: 'من رحلاتنا', items: [] },
  settings: { stats: true, team: true, reviews: true },
};

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function cleanItems(raw: unknown): AboutItem[] {
  return (Array.isArray(raw) ? raw : [])
    .map((i) => ({ title: String(i?.title || '').trim(), text: String(i?.text || '').trim() }))
    .filter((i) => i.title || i.text);
}

/** Page content rows → the About page, with defaults for anything not edited. */
export function readAboutContent(rows: PageContentRow[] | undefined): AboutContent {
  const get = (key: string) => rows?.find((r) => r.key === key);
  const text = (v?: string | null) => (v || '').trim();
  const d = ABOUT_DEFAULTS;

  const hero = get('about_hero');
  const story = get('about_story');
  const values = get('about_values');
  const journey = get('about_journey');
  const gallery = get('about_gallery');
  const settings = parseJson<Partial<AboutSettings>>(get('about_settings')?.content_ar, {});

  const valueItems = values ? cleanItems(parseJson(values.content_ar, [])) : d.values.items;
  const journeyItems = journey ? cleanItems(parseJson(journey.content_ar, [])) : d.journey.items;
  const photos = (parseJson<unknown[]>(gallery?.content_ar, []) as any[])
    .map((p) => ({ url: String(p?.url || '').trim(), caption: String(p?.caption || '').trim() }))
    .filter((p) => p.url);

  return {
    hero: { title: text(hero?.title_ar) || d.hero.title, text: text(hero?.content_ar), image: text(hero?.image_url) || d.hero.image },
    story: { title: text(story?.title_ar) || d.story.title, text: text(story?.content_ar) || d.story.text, image: text(story?.image_url) || d.story.image },
    values: { heading: text(values?.title_ar) || d.values.heading, items: valueItems },
    journey: { heading: text(journey?.title_ar) || d.journey.heading, items: journeyItems },
    gallery: { heading: text(gallery?.title_ar) || d.gallery.heading, items: photos },
    settings: {
      stats: settings.stats !== false,
      team: settings.team !== false,
      reviews: settings.reviews !== false,
    },
  };
}

/** The About page → page content rows to save. */
export function aboutRows(c: AboutContent) {
  return [
    { key: 'about_hero', title_ar: c.hero.title, content_ar: c.hero.text, image_url: c.hero.image },
    { key: 'about_story', title_ar: c.story.title, content_ar: c.story.text, image_url: c.story.image },
    { key: 'about_values', title_ar: c.values.heading, content_ar: JSON.stringify(c.values.items), image_url: '' },
    { key: 'about_journey', title_ar: c.journey.heading, content_ar: JSON.stringify(c.journey.items), image_url: '' },
    { key: 'about_gallery', title_ar: c.gallery.heading, content_ar: JSON.stringify(c.gallery.items), image_url: '' },
    { key: 'about_settings', title_ar: 'إعدادات صفحة عن الوكالة', content_ar: JSON.stringify(c.settings), image_url: '' },
  ].map((r) => ({ ...r, section: 'about' }));
}

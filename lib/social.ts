/**
 * Contact channels and social profiles of the agency, plus share / click-to-chat
 * links. Edited in the dashboard ("واتساب والتواصل"), stored in page_content
 * under the key `social_links` (content_ar = JSON). The WhatsApp number falls
 * back to the agency settings.
 */
import type { PageContentRow } from './page-content';

export type SocialLinks = {
  whatsapp: string;
  welcome: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  telegram: string;
  x: string;
};

export const SOCIAL_KEY = 'social_links';

export const EMPTY_SOCIAL: SocialLinks = {
  whatsapp: '',
  welcome: 'السلام عليكم، أريد الاستفسار عن برامج العمرة',
  facebook: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  telegram: '',
  x: '',
};

export const SOCIAL_LABELS: Record<Exclude<keyof SocialLinks, 'whatsapp' | 'welcome'>, string> = {
  facebook: 'فيسبوك',
  instagram: 'إنستغرام',
  tiktok: 'تيك توك',
  youtube: 'يوتيوب',
  telegram: 'تيليغرام',
  x: 'X (تويتر)',
};

export function readSocialLinks(rows: PageContentRow[] | undefined, agencyWhatsapp = ''): SocialLinks {
  const row = rows?.find((r) => r.key === SOCIAL_KEY);
  let saved: Partial<SocialLinks> = {};
  try {
    saved = row?.content_ar ? JSON.parse(row.content_ar) : {};
  } catch {
    saved = {};
  }
  const clean = (v: unknown) => String(v ?? '').trim();
  return {
    whatsapp: clean(saved.whatsapp) || clean(agencyWhatsapp),
    welcome: clean(saved.welcome) || EMPTY_SOCIAL.welcome,
    facebook: clean(saved.facebook),
    instagram: clean(saved.instagram),
    tiktok: clean(saved.tiktok),
    youtube: clean(saved.youtube),
    telegram: clean(saved.telegram),
    x: clean(saved.x),
  };
}

/** International digits for wa.me (Algerian 0XXXXXXXXX → 213XXXXXXXXX). */
export function waDigits(raw: string): string {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = `213${d.slice(1)}`;
  return d;
}

/** Opens a WhatsApp chat with the agency, message already typed. */
export function waLink(number: string, text = ''): string {
  const d = waDigits(number);
  if (!d) return '';
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Adds campaign tags so the team knows which post brought the visit. */
export function withUtm(url: string, source: string, campaign = 'social'): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', 'social');
    u.searchParams.set('utm_campaign', campaign);
    return u.toString();
  } catch {
    return url;
  }
}

export type ShareTarget = 'whatsapp' | 'facebook' | 'telegram' | 'x';

/** Share links for a page (used by the share buttons). */
export function shareUrl(target: ShareTarget, url: string, text: string): string {
  const tagged = withUtm(url, target, 'share');
  switch (target) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(`${text}\n${tagged}`)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(tagged)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodeURIComponent(tagged)}&text=${encodeURIComponent(text)}`;
    case 'x':
      return `https://twitter.com/intent/tweet?url=${encodeURIComponent(tagged)}&text=${encodeURIComponent(text)}`;
  }
}

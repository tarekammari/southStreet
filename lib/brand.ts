/**
 * The agency's identity (white-label): name, logo, colour, address, phones…
 * Stored in agency_settings (id 'main') and edited by the Super Admin in
 * «هوية الوكالة». Server code reads it with getBrand() (lib/brand-server.ts),
 * client code with useBrand() / useAgencyInfo().
 *
 * DEFAULT_BRAND is South Street, the first agency: it seeds a new database and
 * fills any field an older database does not have yet, so a deploy changes nothing
 * on screen. It is the only place in the code with South Street's identity.
 */
import { EMPTY_SOCIAL, type SocialLinks } from './social';

export type Brand = {
  /** Full Arabic name: «ساوث ستريت للأسفار والعمرة». */
  agency_name: string;
  /** Short Arabic name used in titles and sentences: «ساوث ستريت». */
  short_name: string;
  /** Latin wordmark: «South Street». */
  name_latin: string;
  legal_name: string;
  /** One line under the wordmark. */
  tagline: string;
  /** Title of the home page in search results ('' = built from the names). */
  site_title: string;
  description: string;
  /** Main logo (transparent background). */
  logo_url: string;
  /** Square mark: QR codes, small badges. */
  mark_url: string;
  /** Browser tab icon ('' = the built-in app/icon.png). */
  favicon_url: string;
  /** Link-preview image (Facebook, WhatsApp…). */
  og_image_url: string;
  /** Home hero photos, one URL per line ('' = the built-in Makkah photos). */
  hero_images: string;
  /** Main colour (#rrggbb). */
  primary_color: string;
  address: string;
  city: string;
  country: string;
  map_url: string;
  map_lat: string;
  map_lng: string;
  phone: string;
  whatsapp: string;
  emergency_phone: string;
  email: string;
  /** Public site address, e.g. https://southstreet.dz */
  website: string;
  opening_hours: string;
  social: SocialLinks;
  /** false until the Super Admin saves «هوية الوكالة» once (first-run wizard). */
  configured: boolean;
};

export type BrandField = Exclude<keyof Brand, 'social' | 'configured'>;

export const DEFAULT_BRAND: Brand = {
  agency_name: 'ساوث ستريت للأسفار والعمرة',
  short_name: 'ساوث ستريت',
  name_latin: 'South Street',
  legal_name: 'شركة ساوث ستريت للسياحة والأسفار ذ.م.م',
  tagline: 'عمرة · حج · رحلات',
  site_title: 'سوث ستريت | SOUTH STREET - وكالة الرحلات وعروض العمرة والحج',
  description: 'الوكالة المعتمدة الأولى لرحلات العمرة والحج المباشرة وتأطير المعتمرين بالجزائر',
  logo_url: '/images/south_street_logo_trans.png',
  mark_url: '/images/south_street_logo_just.png',
  favicon_url: '',
  og_image_url: '/og/south-street-og.jpg',
  hero_images: '',
  primary_color: '#047857',
  address: 'شارع خميستي الرئيسي، وسط مدينة الوادي',
  city: 'ولاية الوادي',
  country: 'الجزائر',
  map_url: 'https://maps.app.goo.gl/MszHxUCJwnK7i3Fy6',
  map_lat: '33.36252',
  map_lng: '6.858862',
  phone: '039 39 39 39',
  whatsapp: '+213 550 12 34 56',
  emergency_phone: '+213 661 99 88 77',
  email: 'contact@southstreet.dz',
  website: 'https://southstreet.dz',
  opening_hours: 'الأحد - الخميس: 08:30 صباحاً - 17:30 مساءً',
  social: EMPTY_SOCIAL,
  configured: true,
};

/** Text fields stored as agency_settings columns (same names). */
export const BRAND_FIELDS: BrandField[] = [
  'agency_name', 'short_name', 'name_latin', 'legal_name', 'tagline', 'site_title', 'description',
  'logo_url', 'mark_url', 'favicon_url', 'og_image_url', 'hero_images', 'primary_color',
  'address', 'city', 'country', 'map_url', 'map_lat', 'map_lng',
  'phone', 'whatsapp', 'emergency_phone', 'email', 'website', 'opening_hours',
];

/** Columns added to agency_settings for the brand (the others already existed). */
export const BRAND_NEW_COLUMNS: BrandField[] = [
  'short_name', 'name_latin', 'tagline', 'site_title', 'logo_url', 'mark_url', 'favicon_url', 'og_image_url',
  'hero_images', 'primary_color', 'map_url', 'map_lat', 'map_lng',
];

/** The site cannot render without these: an empty one takes the default. */
const REQUIRED_FIELDS = new Set<BrandField>(['agency_name', 'short_name', 'name_latin', 'logo_url', 'mark_url', 'og_image_url', 'primary_color']);

/**
 * A stored row (or API answer) → a complete brand. A field the row does not
 * have (older database) takes the default; a field saved empty stays empty,
 * except the required ones.
 */
export function brandFrom(row: Partial<Record<string, unknown>> | null | undefined, social?: SocialLinks): Brand {
  const out = { ...DEFAULT_BRAND, social: social || DEFAULT_BRAND.social } as Brand;
  for (const key of BRAND_FIELDS) {
    if (!row || row[key] == null) continue;
    const value = String(row[key]).trim();
    if (value || !REQUIRED_FIELDS.has(key)) out[key] = value;
  }
  // An agency that uploaded only its logo: South Street's mark, share image and
  // tab icon must not show next to it.
  if (out.logo_url !== DEFAULT_BRAND.logo_url) {
    if (out.mark_url === DEFAULT_BRAND.mark_url) out.mark_url = out.logo_url;
    if (out.og_image_url === DEFAULT_BRAND.og_image_url) out.og_image_url = out.logo_url;
    if (!out.favicon_url) out.favicon_url = out.mark_url;
  }
  if (!out.mark_url) out.mark_url = out.logo_url;
  if (!/^#[0-9a-f]{6}$/i.test(out.primary_color)) out.primary_color = DEFAULT_BRAND.primary_color;
  // Another agency that kept South Street's texts: they speak for this agency instead.
  if (!isDefaultBrand(out)) {
    if (out.site_title === DEFAULT_BRAND.site_title) out.site_title = '';
    for (const key of ['legal_name', 'description'] as const) {
      if (out[key] === DEFAULT_BRAND[key]) out[key] = rebrandText(out[key], out);
    }
  }
  if (row && 'configured' in row) out.configured = Boolean(row.configured);
  return out;
}

/** «عن الوكالة | ساوث ستريت». */
export function brandTitle(brand: Pick<Brand, 'short_name'>, title: string): string {
  return `${title} | ${brand.short_name}`;
}

/** «وكالة ساوث ستريت». */
export function agencyLabel(brand: Pick<Brand, 'short_name'>): string {
  return `وكالة ${brand.short_name}`;
}

/** Name of the messenger app: «South Street Connect». */
export function connectName(brand: Pick<Brand, 'name_latin'>): string {
  return `${brand.name_latin} Connect`;
}

/** Short app name under the home-screen icon: «SS Connect». */
export function shortConnectName(brand: Pick<Brand, 'name_latin'>): string {
  const initials = brand.name_latin.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase();
  return initials ? `${initials} Connect` : 'Connect';
}

/** Address on one line: street، city، country. */
export function fullAddress(brand: Pick<Brand, 'address' | 'city' | 'country'>): string {
  return [brand.address, brand.city, brand.country].map((s) => s.trim()).filter(Boolean).join('، ');
}

/** Map pin from the stored position ('' when there is none). */
export function brandGeo(brand: Pick<Brand, 'map_lat' | 'map_lng'>): { latitude: number; longitude: number } | null {
  const latitude = Number(brand.map_lat);
  const longitude = Number(brand.map_lng);
  if (!brand.map_lat || !brand.map_lng || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/** Google Maps link: the shared pin, else the position, else a search for the address. */
export function brandMapUrl(brand: Brand): string {
  if (brand.map_url) return brand.map_url;
  const geo = brandGeo(brand);
  if (geo) return `https://www.google.com/maps?q=${geo.latitude},${geo.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress(brand))}`;
}

/** Embedded map for the About page. */
export function brandMapEmbed(brand: Brand): string {
  const geo = brandGeo(brand);
  const q = geo ? `${geo.latitude},${geo.longitude}` : encodeURIComponent(fullAddress(brand));
  return `https://www.google.com/maps?q=${q}&z=17&hl=ar&output=embed`;
}

/** Hero photos chosen by the agency ([] = the built-in ones). */
export function brandHeroImages(brand: Pick<Brand, 'hero_images'>): string[] {
  return brand.hero_images.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
}

/** Domain without scheme: southstreet.dz */
export function brandDomain(brand: Pick<Brand, 'website'>): string {
  return brand.website.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
}

/**
 * Default-brand text (seeded Sakhr answers, page texts…) rewritten for another
 * brand: South Street's names, address, phone and domain become this agency's.
 */
export function rebrandText(text: string, brand: Brand): string {
  const d = DEFAULT_BRAND;
  const pairs: [string, string][] = [
    [d.agency_name, brand.agency_name],
    [d.legal_name, brand.legal_name],
    [fullAddress(d), fullAddress(brand)],
    [d.address, brand.address],
    [d.city, brand.city],
    [d.short_name, brand.short_name],
    ['سوث ستريت', brand.short_name],
    [d.name_latin.toUpperCase(), brand.name_latin.toUpperCase()],
    [d.name_latin, brand.name_latin],
    [d.phone, brand.phone],
    [d.email, brand.email],
    [brandDomain(d), brandDomain(brand)],
  ];
  let out = text;
  for (const [from, to] of pairs) {
    if (from && to && from !== to) out = out.split(from).join(to);
  }
  return out;
}

/** True when the brand still has South Street's name (texts need no rewrite). */
export function isDefaultBrand(brand: Pick<Brand, 'agency_name' | 'short_name' | 'name_latin'>): boolean {
  return brand.short_name === DEFAULT_BRAND.short_name && brand.name_latin === DEFAULT_BRAND.name_latin;
}

/** `tel:` link in international form: a local Algerian number (0…) becomes +213…. */
export function telHref(phone: string): string {
  let n = phone.replace(/[^\d+]/g, '');
  if (n.startsWith('00')) n = `+${n.slice(2)}`;
  else if (n.startsWith('0')) n = `+213${n.slice(1)}`;
  return `tel:${n}`;
}

/** Same colour, lighter or darker (amount −1…1), for hover and soft backgrounds. */
export function shadeColor(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function rgbChannels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * CSS variables for the brand colour, set on <html> ('' for the default colour:
 * every stylesheet already falls back to it). Stylesheets use
 * var(--brand-primary, #047857) and var(--brand-primary-dark, …).
 */
export function brandCssVars(brand: Pick<Brand, 'primary_color'>): string {
  const c = brand.primary_color.toLowerCase();
  if (c === DEFAULT_BRAND.primary_color) return '';
  const dark = shadeColor(c, -0.3);
  return `:root{--brand-primary:${c};--brand-primary-rgb:${rgbChannels(c)};--brand-primary-dark:${dark};--brand-primary-dark-rgb:${rgbChannels(dark)};}`;
}

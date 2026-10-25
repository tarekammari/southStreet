/**
 * Agency profile folder (deploy/agencies/<slug>/: brand.json + logo + images/)
 * → brand values for «هوية الوكالة». Pure: used by the dashboard's import
 * button (files picked in the browser) and by `npm run brand:import`.
 *
 * Only what the profile states is filled in. Fields it does not have (or lists
 * under toConfirmWithAgency) stay empty: nothing is invented.
 */
import type { BrandBranch, BrandField, BrandPhone } from './brand';

export type BrandProfile = {
  slug?: string;
  suggestedHost?: string;
  name?: { ar?: string; latin?: string; short?: string };
  tagline?: string;
  logo?: string;
  colors?: { primary?: string; accent?: string };
  headquarters?: { address?: string; city?: string; country?: string };
  branches?: { city?: string; address?: string; phone?: string }[];
  phones?: { main?: string; whatsapp?: string | string[]; bookings?: string; other?: string[] };
  email?: string;
  website?: string;
  services?: string[];
  destinations?: string[];
  departureAirports?: string[];
  images?: { hero?: string; programs?: string[]; posts?: string[] };
  knowledge?: string[];
  /** The agency's current programme, created by `npm run brand:import` (not by the dashboard button). */
  starterProgram?: {
    id?: string;
    kind?: 'UMRAH' | 'HAJJ' | 'TOURISM';
    name?: string;
    season?: string;
    start_date?: string;
    end_date?: string;
    duration_days?: number;
    departure_city?: string;
    departure_airport?: string;
    guides?: string;
    description?: string;
    image?: string;
    seats?: number;
    /** DZD per person; null until the agency gives it (the site shows «السعر عند الطلب»). */
    price?: number | null;
    featured?: boolean;
  };
  toConfirmWithAgency?: string[];
};

/** One answer for Sakhr (ai_knowledge row). */
export type BrandKnowledge = { id: string; title: string; keywords: string[]; text: string };

export type ProfileImport = {
  values: Partial<Record<BrandField, string>>;
  branches: BrandBranch[];
  phones: BrandPhone[];
  knowledge: BrandKnowledge[];
  /** Relative asset paths the profile uses (logo, hero…), to upload / copy. */
  assets: string[];
};

const COUNTRIES: Record<string, string> = { DZ: 'الجزائر', TN: 'تونس', MA: 'المغرب', SA: 'السعودية', FR: 'فرنسا' };
const color = (v?: string) => (/^#[0-9a-f]{6}$/i.test(String(v || '').trim()) ? String(v).trim().toLowerCase() : '');
const text = (v?: string) => String(v || '').trim();

/** Relative asset paths named in a profile (no absolute paths, no ".."). */
export function profileAssets(p: BrandProfile): string[] {
  const list = [p.logo, p.images?.hero, ...(p.images?.programs || [])].map(text).filter(Boolean);
  return [...new Set(list)].filter((rel) => !rel.startsWith('/') && !rel.includes('..') && !/^[a-z]+:/i.test(rel));
}

/** Words worth matching a question on (Arabic or Latin, 4+ letters). */
function keywordsOf(line: string): string[] {
  const words = line.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length >= 4);
  return [...new Set(words)].slice(0, 8);
}

/**
 * `asset(rel)` gives the public URL of an uploaded / copied asset ('' when it
 * could not be stored).
 */
export function profileToBrand(p: BrandProfile, asset: (rel: string) => string): ProfileImport {
  const values: Partial<Record<BrandField, string>> = {};
  const set = (key: BrandField, v?: string) => {
    const t = text(v);
    if (t) values[key] = t;
  };
  set('agency_name', p.name?.ar);
  set('short_name', p.name?.short || p.name?.ar);
  set('name_latin', p.name?.latin);
  set('tagline', p.tagline);
  set('primary_color', color(p.colors?.primary));
  set('accent_color', color(p.colors?.accent));
  set('address', p.headquarters?.address);
  set('city', p.headquarters?.city);
  const country = text(p.headquarters?.country);
  set('country', COUNTRIES[country.toUpperCase()] || country);
  set('email', p.email);
  set('website', p.website);

  const logo = p.logo ? asset(p.logo) : '';
  if (logo) {
    values.logo_url = logo;
    values.mark_url = logo;
    values.favicon_url = logo;
    values.og_image_url = logo;
  }
  const hero = [p.images?.hero, ...(p.images?.programs || [])].map((rel) => (rel ? asset(rel) : '')).filter(Boolean);
  if (hero.length) {
    values.hero_images = hero.join('\n');
    values.og_image_url = hero[0];
  }

  const phones: BrandPhone[] = [];
  const whatsapps = (Array.isArray(p.phones?.whatsapp) ? p.phones?.whatsapp : [p.phones?.whatsapp]).map(text).filter(Boolean);
  set('phone', p.phones?.main || whatsapps[0]);
  // The profile's WhatsApp list replaces the default one (empty when it has none).
  values.whatsapp = whatsapps[0] || '';
  for (const n of whatsapps.slice(1)) phones.push({ label: 'واتساب', number: n });
  if (text(p.phones?.bookings)) phones.push({ label: 'الحجوزات', number: text(p.phones?.bookings) });
  for (const n of p.phones?.other || []) if (text(n)) phones.push({ label: 'هاتف', number: text(n) });

  const branches: BrandBranch[] = (p.branches || [])
    .map((b) => ({ city: text(b.city), address: text(b.address), phone: text(b.phone) }))
    .filter((b) => b.city || b.address);

  // Fields the profile does not know are cleared, not left as South Street's.
  for (const key of ['legal_name', 'site_title', 'description', 'map_url', 'map_lat', 'map_lng', 'emergency_phone', 'opening_hours'] as BrandField[]) {
    if (!(key in values)) values[key] = '';
  }
  if (!values.website) values.website = '';

  const knowledge: BrandKnowledge[] = [];
  const services = (p.services || []).map(text).filter(Boolean);
  const destinations = (p.destinations || []).map(text).filter(Boolean);
  const airports = (p.departureAirports || []).map(text).filter(Boolean);
  if (services.length || destinations.length) {
    const lines = [
      services.length ? `🧳 **خدماتنا:** ${services.join('، ')}.` : '',
      destinations.length ? `🌍 **وجهاتنا:** ${destinations.join('، ')}.` : '',
      airports.length ? `✈️ **الانطلاق من:** ${airports.join('، ')}.` : '',
    ].filter(Boolean);
    knowledge.push({
      id: 'brand_services',
      title: 'خدمات الوكالة ووجهاتها',
      keywords: ['خدمات', 'خدماتكم', 'ماذا تقدمون', 'وجهات', 'وجهاتكم', 'تأشيرة', 'تذاكر', ...destinations],
      text: lines.join('\n'),
    });
  }
  (p.knowledge || []).map(text).filter(Boolean).forEach((line, i) => {
    knowledge.push({ id: `brand_note_${i + 1}`, title: line.slice(0, 60), keywords: keywordsOf(line), text: line });
  });

  return { values, branches, phones, knowledge, assets: profileAssets(p) };
}

/**
 * Sakhr Trusted Tools — orchestrated DB-only tool pipeline.
 * Every response is sourced from SQLite tables; no hallucination.
 */

import { AiCard } from '@/types';
import { getSqliteDb } from './sqlite';
import {
  toolSearchKnowledge,
  toolSearchPackages,
  toolGetHotelsInfo,
  toolGetTeamMembers,
  toolGetAgencySettings,
  toolGetSeasonsInfo,
  toolSearchAppContent,
} from './ai-tools';

export type TrustedToolName =
  | 'ai_knowledge'
  | 'page_content'
  | 'packages'
  | 'hotels'
  | 'morshids'
  | 'agency_settings'
  | 'seasons'
  | 'site_map';

export interface TrustedToolHit {
  tool: TrustedToolName;
  table: string;
  confidence: number;
  title: string;
  text: string;
  cards?: AiCard[];
}

export interface TrustedPipelineResult {
  hasAnswer: boolean;
  hit?: TrustedToolHit;
  toolsUsed: TrustedToolName[];
  allHits: TrustedToolHit[];
  isQuestion: boolean;
}

function normalizeArabic(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(prompt: string): string[] {
  const stops = new Set(['هل', 'ما', 'من', 'في', 'على', 'عن', 'ان', 'التي', 'الذي', 'هذا', 'هذه', 'كيف', 'متى']);
  return normalizeArabic(prompt).split(/\s+/).filter(w => w.length > 2 && !stops.has(w));
}

/** Match keywords as whole tokens — avoids "معتمر" matching "مك" */
export function hasArabicKeyword(text: string, keywords: string[]): boolean {
  const normalized = normalizeArabic(text);
  const tokens = normalized.split(/\s+/);

  return keywords.some(kw => {
    const nkw = normalizeArabic(kw);
    if (!nkw) return false;
    // Short keywords (≤3 chars): exact token match only
    if (nkw.length <= 3) {
      return tokens.includes(nkw);
    }
    // Longer keywords: token match OR explicit multi-char phrase
    if (tokens.some(t => t === nkw || (t.includes(nkw) && nkw.length >= 4))) return true;
    return normalized.includes(nkw) && nkw.length >= 5;
  });
}

/** Detect factual / religious Q&A (not navigation or data lookup) */
export function isFactualQuestion(prompt: string): boolean {
  const n = normalizeArabic(prompt);
  const questionStarters = [
    'هل', 'ما', 'ماذا', 'كيف', 'لماذا', 'متى', 'اين', 'أين', 'من',
    'هل يجوز', 'هل يلزم', 'هل يمكن', 'هل تستطيع', 'what', 'how', 'why', 'is it',
  ];
  if (questionStarters.some(q => n.startsWith(normalizeArabic(q)))) return true;
  if (n.includes('؟') || n.includes('?')) return true;
  // Religious / fiqh topics without explicit data-request words
  const fiqhTopics = ['محرم', 'محram', 'يجوز', 'يلزم', 'حكم', 'فتو', 'شروط', 'واجب', 'حرام', 'حلال'];
  const dataRequest = ['فند', 'باق', 'سعر', 'عرض', 'حجز', 'جدول', 'افتح', 'صفح'];
  if (fiqhTopics.some(t => n.includes(normalizeArabic(t))) && !dataRequest.some(d => hasArabicKeyword(n, [d]))) {
    return true;
  }
  return false;
}

/** TOOL: Search page_content table */
function toolSearchPageContent(query: string): TrustedToolHit | null {
  const db = getSqliteDb();
  const rows = db.prepare('SELECT * FROM page_content').all() as any[];
  const tokens = tokenize(query);
  let best: any = null;
  let maxScore = 0;

  for (const row of rows) {
    const hay = normalizeArabic(`${row.title_ar} ${row.content_ar} ${row.section} ${row.key}`);
    let score = 0;
    for (const t of tokens) {
      if (hay.includes(t)) score += 8;
    }
    if (score > maxScore) {
      maxScore = score;
      best = row;
    }
  }

  if (!best || maxScore < 16) return null;

  return {
    tool: 'page_content',
    table: 'page_content',
    confidence: Math.min(maxScore / 40, 1),
    title: best.title_ar || best.key,
    text: `📄 **${best.title_ar}**\n\n${best.content_ar}\n\n✅ *مصدر موثوق: جدول page_content*`,
  };
}

/** TOOL: Search ai_knowledge */
function toolHitFromKnowledge(query: string): TrustedToolHit | null {
  const match = toolSearchKnowledge(query);
  if (!match) return null;

  const rule = match.rule;
  const answer = rule.modelAnswer || rule.response_ar;
  const confidence = Math.min(match.score / 50, 1);

  const cards: AiCard[] = [];
  if (rule.category === 'packages') {
    cards.push({
      type: 'action',
      data: {
        title: rule.title_ar,
        description: 'استعراض الحجز المباشر',
        buttonText: '🚀 صفحة الباقات',
        targetUrl: '/packages',
      },
    });
  }

  return {
    tool: 'ai_knowledge',
    table: 'ai_knowledge',
    confidence,
    title: rule.title_ar,
    text: `${answer}\n\n✅ *مصدر موثوق: قاعدة معرفة الوكالة (${rule.category})*`,
    cards,
  };
}

/** TOOL: Packages */
function toolHitFromPackages(query: string): TrustedToolHit | null {
  if (!hasArabicKeyword(query, ['باقة', 'باقات', 'عرض', 'عروض', 'سعر', 'اسعار', 'أسعار', 'package', 'offer', 'price', 'حجز باقة'])) {
    return null;
  }

  const packages = toolSearchPackages({ query: query.length > 15 ? query : undefined });
  if (!packages.length) return null;

  let text = `📦 **باقات العمرة المعتمدة**\n\n`;
  const cards: AiCard[] = packages.slice(0, 4).map(pkg => {
    const minPrice = pkg.prices?.length ? Math.min(...pkg.prices.map(p => p.amount)) : 0;
    text += `• **${pkg.name}** — من ${minPrice.toLocaleString()} دج | ${pkg.duration_days} يوم\n`;
    return {
      type: 'package' as const,
      data: {
        id: pkg.package_id,
        name: pkg.name,
        type: pkg.type,
        makkah_hotel_name: pkg.makkah_hotel_name,
        makkah_hotel_dist: pkg.makkah_hotel_dist,
        airline: pkg.airline,
        duration_days: pkg.duration_days,
        available: pkg.available,
        description: pkg.description,
        prices: pkg.prices.map(p => ({ room_type: p.room_type, amount: p.amount, currency: p.currency || 'دج' })),
      },
    };
  });

  return {
    tool: 'packages',
    table: 'packages',
    confidence: 0.85,
    title: 'باقات العمرة',
    text: text.trim() + '\n\n✅ *مصدر موثوق: جدول packages*',
    cards,
  };
}

/** TOOL: Hotels */
function toolHitFromHotels(query: string): TrustedToolHit | null {
  if (!hasArabicKeyword(query, ['فندق', 'فنادق', 'hotel', 'hotels', 'إقامة', 'مكة', 'مكه', 'المدينة', 'الحرم', 'سويس', 'منارات'])) {
    return null;
  }

  let city: string | undefined;
  const n = normalizeArabic(query);
  if (hasArabicKeyword(query, ['مكة', 'مكه'])) city = 'MAKKAH';
  if (hasArabicKeyword(query, ['المدينة', 'مدينة'])) city = 'MADINAH';

  const hotels = toolGetHotelsInfo(city);
  if (!hotels.length) return null;

  let text = `🏨 **فنادقنا المعتمدة**\n\n`;
  const cards: AiCard[] = hotels.map(h => {
    text += `• **${h.name}** — ${h.distance_from_haram}\n`;
    return { type: 'hotel' as const, data: h };
  });

  return { tool: 'hotels', table: 'hotels', confidence: 0.85, title: 'الفنادق', text: text.trim() + '\n\n✅ *مصدر موثوق: جدول hotels*', cards };
}

/** TOOL: Team */
function toolHitFromTeam(query: string): TrustedToolHit | null {
  if (!hasArabicKeyword(query, ['مرشد', 'مرشدين', 'مرشدة', 'شيخ', 'طاقم', 'فريق', 'guide', 'staff', 'team', 'من نحن'])) {
    return null;
  }

  let category: string | undefined;
  if (hasArabicKeyword(query, ['نساء', 'مرشدة', 'مرشدات', 'أخوات', 'سيدات'])) category = 'women_guide';
  else if (hasArabicKeyword(query, ['إدارة', 'ادارة', 'موظف', 'staff'])) category = 'staff';

  const team = toolGetTeamMembers(category);
  if (!team.length) return null;

  let text = `👥 **طاقم الوكالة والمرشدون**\n\n`;
  const cards: AiCard[] = team.map(m => {
    text += `• **${m.name}** — ${m.roleName}\n`;
    return { type: 'morshid' as const, data: m };
  });

  return { tool: 'morshids', table: 'morshids', confidence: 0.82, title: 'الطاقم', text: text.trim() + '\n\n✅ *مصدر موثوق: جدول morshids*', cards };
}

/** TOOL: Agency */
function toolHitFromAgency(query: string): TrustedToolHit | null {
  if (!hasArabicKeyword(query, ['وكالة', 'عنوان', 'هاتف', 'تواصل', 'contact', 'phone', 'address', 'مقر', 'اين', 'أين', 'رقم'])) {
    return null;
  }

  const a = toolGetAgencySettings();
  if (!a.agency_name) return null;

  const text =
    `🏢 **${a.agency_name}**\n\n` +
    `📍 ${a.address}، ${a.city}\n📞 ${a.phone}\n💬 ${a.whatsapp}\n📧 ${a.email}\n⏰ ${a.opening_hours}` +
    `\n\n✅ *مصدر موثوق: جدول agency_settings*`;

  return { tool: 'agency_settings', table: 'agency_settings', confidence: 0.8, title: a.agency_name, text };
}

/** TOOL: Seasons */
function toolHitFromSeasons(query: string): TrustedToolHit | null {
  if (!hasArabicKeyword(query, ['موسم', 'مواسم', 'season', 'رمضان', 'حج', 'أوت', 'اوت', 'اغسطس'])) {
    return null;
  }

  const n = normalizeArabic(query);
  const type = hasArabicKeyword(query, ['حج']) && !hasArabicKeyword(query, ['عمرة', 'اعتمر']) ? 'HAJJ' as const : undefined;
  const seasons = toolGetSeasonsInfo(type);
  if (!seasons.length) return null;

  let text = `🗓️ **مواسم الرحلات**\n\n`;
  for (const s of seasons) {
    text += `• **${s.name}** — ${s.status}\n`;
  }

  return { tool: 'seasons', table: 'seasons', confidence: 0.78, title: 'المواسم', text: text.trim() + '\n\n✅ *مصدر موثوق: جدول seasons*' };
}

/** TOOL: Site map */
function toolHitFromSiteMap(query: string): TrustedToolHit | null {
  if (!hasArabicKeyword(query, ['افتح', 'اذهب', 'خذني', 'صفحة', 'قسم', 'انتقل', 'عرض صف'])) {
    return null;
  }

  const matches = toolSearchAppContent(query, 3);
  if (!matches.length || matches[0].score < 15) return null;

  let text = `🗺️ **عناصر التطبيق**\n\n`;
  const cards: AiCard[] = matches.map(m => {
    const label = m.type === 'section' && m.section ? m.section.title : m.page.title;
    const desc = m.type === 'section' && m.section ? m.section.description : m.page.description;
    const path = m.type === 'section' && m.section?.anchor ? `${m.page.path}${m.section.anchor}` : m.page.path;
    text += `• **${label}**: ${desc}\n`;
    return { type: 'action' as const, data: { title: label, description: desc, buttonText: `↗ ${label}`, targetUrl: path } };
  });

  return { tool: 'site_map', table: 'app_sitemap', confidence: 0.75, title: 'خريطة التطبيق', text: text.trim(), cards };
}

/**
 * Run trusted tools — for factual questions, ONLY ai_knowledge counts.
 */
export function runTrustedToolPipeline(prompt: string): TrustedPipelineResult {
  const isQuestion = isFactualQuestion(prompt);
  const allHits: TrustedToolHit[] = [];
  const toolsUsed: TrustedToolName[] = [];

  // Always check knowledge first
  const knowledgeHit = toolHitFromKnowledge(prompt);
  if (knowledgeHit) {
    allHits.push(knowledgeHit);
    toolsUsed.push('ai_knowledge');
  }

  // For factual Q&A: only return if knowledge matched
  if (isQuestion) {
    if (knowledgeHit && knowledgeHit.confidence >= 0.15) {
      return { hasAnswer: true, hit: knowledgeHit, toolsUsed, allHits, isQuestion: true };
    }
    return { hasAnswer: false, toolsUsed, allHits, isQuestion: true };
  }

  // Data / navigation tools — only for non-question intents
  const dataRunners: Array<{ name: TrustedToolName; fn: () => TrustedToolHit | null }> = [
    { name: 'page_content', fn: () => toolSearchPageContent(prompt) },
    { name: 'packages', fn: () => toolHitFromPackages(prompt) },
    { name: 'hotels', fn: () => toolHitFromHotels(prompt) },
    { name: 'morshids', fn: () => toolHitFromTeam(prompt) },
    { name: 'agency_settings', fn: () => toolHitFromAgency(prompt) },
    { name: 'seasons', fn: () => toolHitFromSeasons(prompt) },
    { name: 'site_map', fn: () => toolHitFromSiteMap(prompt) },
  ];

  for (const { name, fn } of dataRunners) {
    const hit = fn();
    if (hit) {
      toolsUsed.push(name);
      allHits.push(hit);
    }
  }

  allHits.sort((a, b) => b.confidence - a.confidence);
  const best = allHits[0];

  if (best && best.confidence >= 0.7) {
    return { hasAnswer: true, hit: best, toolsUsed, allHits, isQuestion: false };
  }

  if (knowledgeHit) {
    return { hasAnswer: true, hit: knowledgeHit, toolsUsed, allHits, isQuestion: false };
  }

  return { hasAnswer: false, toolsUsed, allHits, isQuestion };
}

/** Build context blob from all DB tables */
export function buildFullTrustedContext(): string {
  const db = getSqliteDb();
  const parts: string[] = [];

  const rules = db.prepare('SELECT title_ar, category, response_ar FROM ai_knowledge WHERE is_active = 1').all() as any[];
  parts.push(`[ai_knowledge]\n` + rules.map(r => `• ${r.title_ar}: ${(r.response_ar || '').slice(0, 200)}`).join('\n'));

  const agency = toolGetAgencySettings();
  parts.push(`[agency_settings]\n${agency.agency_name} | ${agency.phone}`);

  return parts.join('\n\n');
}

export const TRUSTED_TOOL_CATALOG = [
  { id: 'ai_knowledge', table: 'ai_knowledge', description: 'قواعد المعرفة المعتمدة' },
  { id: 'page_content', table: 'page_content', description: 'محتوى الصفحات' },
  { id: 'packages', table: 'packages', description: 'باقات العمرة' },
  { id: 'hotels', table: 'hotels', description: 'الفنادق' },
  { id: 'morshids', table: 'morshids', description: 'المرشدون' },
  { id: 'agency_settings', table: 'agency_settings', description: 'معلومات الوكالة' },
  { id: 'seasons', table: 'seasons', description: 'المواسم' },
  { id: 'site_map', table: 'app_sitemap', description: 'صفحات التطبيق' },
] as const;

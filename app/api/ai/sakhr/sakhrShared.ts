import { AiCard, AiAction } from '@/types';
import { getDatabase, saveDatabase, AiKnowledgeRule } from '@/lib/db';
import { getSqliteDb } from '@/lib/sqlite';
import {
  toolSearchPackages,
  toolGetSeasonsInfo,
  toolGetAgencySettings,
  toolGetTeamMembers,
  toolGetHotelsInfo,
  toolSearchKnowledge,
  toolComparePackages,
  toolSearchAppContent,
  toolResolveNavigation,
  toolGetSiteInventory,
  toolGetSitemapContext,
} from '@/lib/ai-tools';
import { runTrustedToolPipeline, hasArabicKeyword, isFactualQuestion } from '@/lib/sakhr-trusted-tools';
import { callExternalAI } from '@/lib/sakhr-external-ai';

export const AGENCY_SOURCE_LABELS: Record<string, string> = {
  ai_knowledge: 'قاعدة معرفة الوكالة المعتمدة',
  page_content: 'محتوى صفحات التطبيق',
  packages: 'جدول باقات العمرة والحج',
  hotels: 'جدول الفنادق المعتمدة',
  morshids: 'جدول المرشدين وطاقم الوكالة',
  agency_settings: 'إعدادات الوكالة الرسمية',
  seasons: 'جدول المواسم والرحلات',
  app_sitemap: 'خريطة التطبيق',
};

export function getAgencySourceLabel(table: string): string {
  return AGENCY_SOURCE_LABELS[table] || `قاعدة بيانات الوكالة (${table})`;
}

// General Knowledge Base for instant answers
export const GENERAL_KB: Record<string, string> = {
  'جبل': 'ف أعلى قمة جبلية في العالم هي قمة إيفرست في سلسلة جبال الهيمالايا، ويصل ارتفاعها إلى حوالي 8,848 متراً فوق سطح البحر. أما في الجزائر فأعلى قمة هي قمة تاهات آتاكور في الهقار بارتفاع 2,908 م.',
  'المانيا': '🇩🇪 مساحة ألمانيا الإجمالية تبلغ حوالي 357,588 كيلومتر مربع (357,588 كم²). وعاصمتها برلين.',
  'ألمانيا': '🇩🇪 مساحة ألمانيا الإجمالية تبلغ حوالي 357,588 كيلومتر مربع (357,588 كم²). وعاصمتها برلين.',
  'عاصمة': '🏛️ يمكنك الاستفسار عن عاصمة أو تفاصيل أي دولة، ويسعدني تزويدك بالمعلومات الجغرافية والخدمية فوراً.',
};

/**
 * Clean and extract readable text from HTML for Web tool
 */
export function extractCleanTextFromHtml(html: string): { title: string; text: string } {
  let title = 'موقع إلكتروني';
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(/\s+/g, ' ').trim();
  }

  let clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  clean = clean.substring(0, 1800);
  return { title, text: clean };
}

/**
 * Fetch and summarize webpage live in real time
 */
export async function fetchWebPageTool(url: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/127.0 (Sakhr AI Agent)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const html = await res.text();
    const { title, text } = extractCleanTextFromHtml(html);
    if (!text || text.length < 20) return null;

    return { title, text: text.substring(0, 800), url };
  } catch {
    return null;
  }
}

/**
 * Detect site inventory / exploration queries — "what pages", "show sections", etc.
 */

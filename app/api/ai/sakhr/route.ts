import { NextResponse } from 'next/server';
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
import {
  getAgencySourceLabel,
  GENERAL_KB,
  fetchWebPageTool,
} from './sakhrShared';
import {
  detectSiteInventoryIntent,
  detectSmartNavigationIntent,
  detectHotelIntent,
  detectCompareIntent,
  detectNavigationIntent,
  detectAdminDbToolsIntent,
  detectMorchedIntent,
  detectPackageOfferIntent,
  detectAgencyCustomIntents,
  buildNoKnowledgeResponse,
  generateLocalRagResponse,
} from './sakhrIntents';
import {
  normalizeSessionHistory,
  sanitizeSakhrReply,
  SAKHR_HISTORY_TURNS,
} from '@/lib/sakhr-smart';

function sakhrJson(payload: any, init?: { status?: number }) {
  if (payload && typeof payload.text === 'string') {
    payload = { ...payload, text: sanitizeSakhrReply(payload.text) };
  }
  return NextResponse.json(payload, init);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = (body.prompt || '').trim();
    const history = normalizeSessionHistory(body.history || [], SAKHR_HISTORY_TURNS);
if (!prompt) {
      return sakhrJson({
        text: 'يرجى كتابة سؤالك وسيجيبك صخر فوراً. 🕋'
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 0: Site inventory / sitemap exploration
    // ─────────────────────────────────────────────────────────────
    const inventoryResult = detectSiteInventoryIntent(prompt);
    if (inventoryResult) {
      return sakhrJson(inventoryResult);
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 0.5: Smart sitemap-based navigation (natural language)
    // ─────────────────────────────────────────────────────────────
    const smartNavResult = detectSmartNavigationIntent(prompt);
    if (smartNavResult) {
      return sakhrJson({
        text: smartNavResult.text,
        actions: smartNavResult.action ? [smartNavResult.action] : [],
        cards: smartNavResult.actionCard ? [smartNavResult.actionCard] : [],
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 1: Deep App Navigation Intent (Instant Action)
    // ─────────────────────────────────────────────────────────────
    const navResult = detectNavigationIntent(prompt);
    if (navResult) {
      return sakhrJson({
        text: navResult.text,
        actions: navResult.action ? [navResult.action] : [],
        cards: navResult.actionCard ? [navResult.actionCard] : []
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 1.5: Admin Database Inspection, Table Viewer, Data Insertion & Formula Training
    // ─────────────────────────────────────────────────────────────
    const dbToolsResult = detectAdminDbToolsIntent(prompt);
    if (dbToolsResult) {
      return sakhrJson(dbToolsResult);
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 2: Morched (Guide) & Team Discovery (SQLite Query)
    // ─────────────────────────────────────────────────────────────
    const morchedResult = detectMorchedIntent(prompt);
    if (morchedResult) {
      return sakhrJson({
        text: morchedResult.text,
        cards: morchedResult.cards,
        actions: []
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 3: Live Packages & Offers Tool (SQLite Query)
    // ─────────────────────────────────────────────────────────────
    const packageResult = detectPackageOfferIntent(prompt);
    if (packageResult) {
      return sakhrJson({
        text: packageResult.text,
        cards: packageResult.cards,
        actions: []
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 3.6: Hotel Discovery
    // ─────────────────────────────────────────────────────────────
    const hotelResult = detectHotelIntent(prompt);
    if (hotelResult) {
      return sakhrJson({ text: hotelResult.text, cards: hotelResult.cards, actions: [] });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 3.7: Package Comparison
    // ─────────────────────────────────────────────────────────────
    const compareResult = detectCompareIntent(prompt);
    if (compareResult) {
      return sakhrJson({ text: compareResult.text, cards: compareResult.cards, actions: [] });
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 3.5: Director, Accountant, Agency Headquarters & Installments (2 to 10 months)
    // ─────────────────────────────────────────────────────────────
    const customResult = detectAgencyCustomIntents(prompt);
    if (customResult) {
      return sakhrJson(customResult);
    }

    // ─────────────────────────────────────────────────────────────
    // TOOL 4: Live Web Page Scraper Tool (if URL provided)
    // ─────────────────────────────────────────────────────────────
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/i);
    if (urlMatch && urlMatch[0]) {
      const targetUrl = urlMatch[0];
      const webResult = await fetchWebPageTool(targetUrl);
      if (webResult) {
        return sakhrJson({
          text: `🌐 **قراءة مباشرة من الموقع:** [${webResult.title}](${webResult.url})\n\n${webResult.text}\n\n💡 *تم استخراج وتلخيص الإجابة مباشرة من الرابط المطلوب بواسطة أداة الويب لصخر.*`,
          cards: [],
          actions: []
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 0: Trusted Tools Pipeline — all SQLite tables, scored & sourced
    // ─────────────────────────────────────────────────────────────
    const trusted = runTrustedToolPipeline(prompt);
    if (trusted.hasAnswer && trusted.hit) {
      return sakhrJson({
        text: sanitizeSakhrReply(trusted.hit.text),
        cards: trusted.hit.cards || [],
        actions: [],
        trusted: true,
        externalAi: false,
        sourceType: 'agency_db',
        source: trusted.hit.table,
        sourceLabel: getAgencySourceLabel(trusted.hit.table),
        toolsUsed: trusted.toolsUsed,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 0b: Legacy single knowledge match (fallback if pipeline missed)
    // ─────────────────────────────────────────────────────────────
    const dbMatch = toolSearchKnowledge(prompt);
    if (dbMatch) {
      const rule = dbMatch.rule;
      const cards: AiCard[] = [];
      const actions: AiAction[] = [];

      if (rule.category === 'packages') {
        cards.push({
          type: 'action',
          data: {
            title: rule.title_ar,
            description: 'استعراض الحجز المباشر لهذه الباقة',
            buttonText: '🚀 الانتقال لمسار الحجز',
            targetUrl: '/book'
          }
        });
      }

      const selectedAnswer = rule.modelAnswer || rule.response_ar;
      return sakhrJson({
        text: sanitizeSakhrReply(selectedAnswer),
        cards,
        actions,
        trusted: true,
        externalAi: false,
        sourceType: 'agency_db',
        source: 'ai_knowledge',
        sourceLabel: getAgencySourceLabel('ai_knowledge'),
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 1: Greetings & navigation-only local responses
    // ─────────────────────────────────────────────────────────────
    const localResult = await generateLocalRagResponse(prompt);
    if (!(localResult as { noKnowledge?: boolean }).noKnowledge) {
      return sakhrJson(localResult);
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 2: External AI fallback — general knowledge with source label
    // ─────────────────────────────────────────────────────────────
    const external = await callExternalAI(prompt, history as Array<{ role: string; text: string }>);
    if (external.success && external.text) {
      return sakhrJson({
        text: sanitizeSakhrReply(external.text),
        cards: [],
        trusted: false,
        externalAi: true,
        sourceType: external.sourceType || 'external_ai',
        source: external.source,
        sourceLabel: external.sourceLabel || external.source,
        model: external.model,
      });
    }

    // External AI unavailable — knowledge gap
    return sakhrJson(buildNoKnowledgeResponse(prompt, !external.success));

  } catch (error: any) {
    console.error('[Sakhr Route Error]:', error?.message);
    return sakhrJson(
      { error: 'حدث خطأ في معالجة طلب الذكاء الاصطناعي' },
      { status: 500 }
    );
  }
}

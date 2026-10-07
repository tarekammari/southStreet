/**
 * External AI fallback — when no trusted DB answer exists.
 * Order (SAKHR_AI_PROVIDER=auto): Pollinations → Gemini → xAI Grok → local FAQ.
 * Always labels the source clearly.
 */

import { toolGetAgencySettings } from './ai-tools';
import {
  sanitizeSakhrReply,
  normalizeSessionHistory,
  buildGroundedSystemExtras,
  SAKHR_HISTORY_TURNS,
} from './sakhr-smart';

export interface ExternalAiResult {
  success: boolean;
  text?: string;
  source: string;
  sourceLabel?: string;
  sourceType?: 'external_ai' | 'local_guidance';
  model: string;
  externalAi?: boolean;
  trusted?: boolean;
}

/** Pollinations: prefer legacy free endpoints; keyed gen.pollinations.ai as fallback. */
const POLLINATIONS_LEGACY_GET = 'https://text.pollinations.ai/';
const POLLINATIONS_LEGACY_OPENAI = 'https://text.pollinations.ai/openai';
const POLLINATIONS_GEN_CHAT = 'https://gen.pollinations.ai/v1/chat/completions';
const POLLINATIONS_DEFAULT_MODEL = 'openai';
const POLLINATIONS_SOURCE = 'Pollinations';
const POLLINATIONS_SOURCE_LABEL = "Pollinations — ذكاء اصطناعي خارجي";

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_SOURCE = 'Google Gemini 1.5 Flash';
const GEMINI_SOURCE_LABEL = 'Google Gemini — ذكاء اصطناعي خارجي';

/** xAI Grok — optional only when XAI_API_KEY / GROK_API_KEY is set. Model: docs.x.ai (2026). */
const XAI_MODEL = 'grok-4.6';
const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions';
const XAI_SOURCE = 'xAI Grok';
const XAI_SOURCE_LABEL = "xAI Grok — ذكاء اصطناعي خارجي";

const LOCAL_FAQ_SOURCE = 'إرشادات صخر العامة';

/** Curated FAQ when no external provider succeeds */
const LOCAL_FAQ: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ['محرم', 'المحرم', 'بدون محرم', 'محram', 'mahram'],
    answer:
      '🧕 **حكم المحرم للمرأة في العمرة:**\n\n' +
      '• جمهور العلماء يرى **وجوب محرم** للمرأة في سفر العمرة إذا تجاوزت مسافة القصر.\n' +
      '• **التأشيرة السعودية (نسك)** تشترط عادةً محرماً أو مجموعة نسائية معتمدة حسب اللوائح الرسمية.\n' +
      '• **وكالة ساوث ستريت** تلتزم بالأنظمة ولا تقبل ملفات مخالفة لاشتراطات التأشيرة.\n\n' +
      '📞 للاستشارة الخاصة: تواصل مع الإدارة أو المرشدة الدينية عبر بوابة الوكالة.',
  },
  {
    keywords: ['الإحرام', 'احرام', 'ميقات', 'ihram'],
    answer:
      '🕋 **الإحرام:** ينوي المعتمر العمرة ويلبس الإزار والرداء (للرجال) أو ملابس محتشمة (للنساء) من **الميقات** قبل دخول الحرم، مع التلبية: *لبيك اللهم لبيك*.',
  },
  {
    keywords: ['طواف', 'الطواف', 'tawaf'],
    answer:
      '🕋 **الطواف:** سبعة أشواط حول الكعبة المشرفة، يبدأ من الحجر الأسود وينتهي عنده، مع الدعاء في كل شوط.',
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
}

function searchLocalFaq(prompt: string): string | null {
  const n = normalize(prompt);
  for (const faq of LOCAL_FAQ) {
    if (faq.keywords.some(kw => n.includes(normalize(kw)))) {
      return faq.answer;
    }
  }
  return null;
}

function buildSystemInstruction(agency: { agency_name?: string; phone?: string }): string {
  return (
    'أنت **صخر**، المساعد الذكي لوكالة ' +
    (agency.agency_name || 'ساوث ستريت') +
    ' للعمرة والحج بالجزائر.\n\n' +
    'دورك: الإجابة على أسئلة المستخدم بلغة عربية واضحة ومهنية.\n\n' +
    'قواعد:\n' +
    '1. استخدم معرفتك في أحكام العمرة والحج والفقه والسفر.\n' +
    '2. لا تخترع أسعاراً أو باقات محددة.\n' +
    '3. للسياسات الخاصة بالوكالة، اقترح التواصل: ' +
    (agency.phone || '+213 21 55 44 33') +
    '.\n' +
    '4. كن مختصراً ومفيداً.' +
    buildGroundedSystemExtras()
  );
}

function providerPreference(): 'auto' | 'pollinations' | 'gemini' | 'xai' {
  const raw = (process.env.SAKHR_AI_PROVIDER || 'auto').toLowerCase().trim();
  if (raw === 'pollinations' || raw === 'pollination') return 'pollinations';
  if (raw === 'gemini') return 'gemini';
  if (raw === 'xai' || raw === 'grok') return 'xai';
  return 'auto';
}

function isTruthyEnv(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function getPollinationsModel(): string {
  return (process.env.POLLINATIONS_MODEL || POLLINATIONS_DEFAULT_MODEL).trim() || POLLINATIONS_DEFAULT_MODEL;
}

function getGeminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.SAKHR_GEMINI_KEY || undefined;
}

function getXaiKey(): string | undefined {
  return process.env.XAI_API_KEY || process.env.GROK_API_KEY || undefined;
}

function localGuidanceResult(prompt: string, labelExtra?: string): ExternalAiResult | null {
  const local = searchLocalFaq(prompt);
  if (!local) return null;
  return {
    success: true,
    text: sanitizeSakhrReply(local),
    source: LOCAL_FAQ_SOURCE,
    sourceLabel: labelExtra ? LOCAL_FAQ_SOURCE + labelExtra : LOCAL_FAQ_SOURCE,
    sourceType: 'local_guidance',
    model: 'local-faq',
    externalAi: true,
    trusted: false,
  };
}

function okExternal(
  text: string,
  source: string,
  sourceLabel: string,
  model: string
): ExternalAiResult | null {
  const replyText = (text || "").toString().trim();
  if (!replyText || replyText.length < 10) return null;
  // Reject obvious JSON error payloads
  if (replyText.startsWith('{') && /"error"/i.test(replyText)) return null;
  return {
    success: true,
    text: sanitizeSakhrReply(replyText),
    source,
    sourceLabel,
    sourceType: 'external_ai',
    model,
    externalAi: true,
    trusted: false,
  };
}

async function callPollinations(
  prompt: string,
  history: Array<{ role: string; text: string }>,
  systemInstruction: string
): Promise<ExternalAiResult | null> {
  const model = getPollinationsModel();
  const apiKey = (process.env.POLLINATIONS_API_KEY || "").trim();

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemInstruction },
  ];
  for (const h of normalizeSessionHistory(history, SAKHR_HISTORY_TURNS)) {
    messages.push({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text,
    });
  }
  messages.push({ role: "user", content: prompt });

  // 1) Legacy simple GET (anonymous-friendly)
  try {
    const combined =
      systemInstruction + "\n\n" + prompt;
    const url =
      POLLINATIONS_LEGACY_GET +
      encodeURIComponent(combined) +
      '?model=' +
      encodeURIComponent(model) +
      '&system=' +
      encodeURIComponent(systemInstruction);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/plain, application/json' },
    });
    if (res.ok) {
      const text = await res.text();
      const hit = okExternal(text, POLLINATIONS_SOURCE, POLLINATIONS_SOURCE_LABEL, model);
      if (hit) return hit;
    }
  } catch {
    /* try next path */
  }


  // 2) Legacy OpenAI-compatible POST (may 402 anonymous)
  try {
    const res = await fetch(POLLINATIONS_LEGACY_OPENAI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
      }),
    });
    if (res.ok) {
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("application/json")) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        const hit = okExternal(text, POLLINATIONS_SOURCE, POLLINATIONS_SOURCE_LABEL, model);
        if (hit) return hit;
      } else {
        const text = await res.text();
        const hit = okExternal(text, POLLINATIONS_SOURCE, POLLINATIONS_SOURCE_LABEL, model);
        if (hit) return hit;
      }
    }
  } catch {
    /* try next path */
  }

  // 3) Newer keyed endpoint (optional POLLINATIONS_API_KEY from enter.pollinations.ai)
  if (apiKey) {
    try {
      const res = await fetch(POLLINATIONS_GEN_CHAT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        const hit = okExternal(text, POLLINATIONS_SOURCE, POLLINATIONS_SOURCE_LABEL, model);
        if (hit) return hit;
      }
    } catch {
      /* fall through */
    }
  }

  return null;
}

async function callGemini(
  prompt: string,
  history: Array<{ role: string; text: string }>,
  systemInstruction: string,
  apiKey: string
): Promise<ExternalAiResult | null> {
  const historyContents = normalizeSessionHistory(history, SAKHR_HISTORY_TURNS).map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }],
  }));

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        GEMINI_MODEL +
        ':generateContent?key=' +
        apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            ...historyContents,
            {
              role: 'user',
              parts: [{ text: systemInstruction + '\n\nسؤال المستخدم: ' + prompt }],
            },
          ],
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return okExternal(replyText || "", GEMINI_SOURCE, GEMINI_SOURCE_LABEL, GEMINI_MODEL);
  } catch {
    return null;
  }
}

async function callXaiGrok(
  prompt: string,
  history: Array<{ role: string; text: string }>,
  systemInstruction: string,
  apiKey: string
): Promise<ExternalAiResult | null> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemInstruction },
  ];
  for (const h of normalizeSessionHistory(history, SAKHR_HISTORY_TURNS)) {
    messages.push({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text,
    });
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const res = await fetch(XAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages,
        temperature: 0.4,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const replyText = (data.choices?.[0]?.message?.content || '').toString().trim();
    return okExternal(replyText, XAI_SOURCE, XAI_SOURCE_LABEL, XAI_MODEL);
  } catch {
    return null;
  }
}

/**
 * Call external AI with general knowledge for questions not in the agency DB.
 * auto order: Pollinations (if enabled) → Gemini → xAI → local FAQ.
 * Force: SAKHR_AI_PROVIDER=pollinations|gemini|xai
 */
export async function callExternalAI(
  prompt: string,
  history: Array<{ role: string; text: string }> = []
): Promise<ExternalAiResult> {
  const pref = providerPreference();
  const pollinationsOn = isTruthyEnv(process.env.POLLINATIONS_ENABLED);
  const geminiKey = getGeminiKey();
  const xaiKey = getXaiKey();

  const agency = toolGetAgencySettings();
  const systemInstruction = buildSystemInstruction(agency);

  const tryPollinations = (pref === 'auto' || pref === 'pollinations') && pollinationsOn;
  const tryGemini = (pref === 'auto' || pref === 'gemini') && Boolean(geminiKey);
  const tryXai = (pref === 'auto' || pref === 'xai') && Boolean(xaiKey);

  let attemptedApi = false;

  if (tryPollinations) {
    attemptedApi = true;
    const poll = await callPollinations(prompt, history, systemInstruction);
    if (poll) return poll;
  }

  if (tryGemini && geminiKey) {
    attemptedApi = true;
    const gemini = await callGemini(prompt, history, systemInstruction, geminiKey);
    if (gemini) return gemini;
  }

  if (tryXai && xaiKey) {
    attemptedApi = true;
    const grok = await callXaiGrok(prompt, history, systemInstruction, xaiKey);
    if (grok) return grok;
  }

  const local = localGuidanceResult(
    prompt,
    attemptedApi ? " (API غير متاح)" : undefined
  );
  if (local) return local;

  // Soft Arabic guidance instead of a bare failure when nothing matched
  if (attemptedApi || pollinationsOn || geminiKey || xaiKey) {
    return {
      success: true,
      text: sanitizeSakhrReply(
        'عذراً، لم أتمكن من جلب إجابة من الخدمات الخارجية الآن.\n\n' +
        'جرّب سؤالاً عن العمرة/الحج أو بيانات الوكالة، أو أعد المحاولة بعد لحظات.\n\n' +
        'للاستفسار المباشر: ' +
        (agency.phone || '+213 21 55 44 33') +
        '.'
      ),
      source: LOCAL_FAQ_SOURCE,
      sourceLabel: LOCAL_FAQ_SOURCE + ' (fallback)',
      sourceType: 'local_guidance',
      model: 'local-soft-fallback',
      externalAi: true,
      trusted: false,
    };
  }

  if (pref === 'pollinations') {
    return { success: false, source: POLLINATIONS_SOURCE, model: getPollinationsModel() };
  }
  if (pref === 'gemini') {
    return { success: false, source: GEMINI_SOURCE, model: GEMINI_MODEL };
  }
  if (pref === 'xai') {
    return { success: false, source: XAI_SOURCE, model: XAI_MODEL };
  }
  return { success: false, source: 'none', model: '' };
}

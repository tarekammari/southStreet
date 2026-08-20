/**
 * External AI fallback — when no trusted DB answer exists.
 * Uses Google Gemini with general knowledge; always labels the source.
 */

import { toolGetAgencySettings } from './ai-tools';

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

const GEMINI_SOURCE = 'Google Gemini 1.5 Flash';
const GEMINI_SOURCE_LABEL = 'Google Gemini — ذكاء اصطناعي خارجي';
const LOCAL_FAQ_SOURCE = 'إرشادات صخر العامة';

/** Curated FAQ when Gemini API key is not configured */
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

/**
 * Call external AI (Gemini) with general knowledge for questions
 * not covered by the agency database.
 */
export async function callExternalAI(
  prompt: string,
  history: Array<{ role: string; text: string }> = []
): Promise<ExternalAiResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.SAKHR_GEMINI_KEY;

  if (!apiKey) {
    const local = searchLocalFaq(prompt);
    if (local) {
      return {
        success: true,
        text: local,
        source: LOCAL_FAQ_SOURCE,
        sourceLabel: LOCAL_FAQ_SOURCE,
        sourceType: 'local_guidance',
        model: 'local-faq',
        externalAi: true,
        trusted: false,
      };
    }
    return { success: false, source: 'none', model: '' };
  }

  const agency = toolGetAgencySettings();

  const systemInstruction =
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
    '4. كن مختصراً ومفيداً.';

  const historyContents = history.slice(-6).map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }],
  }));

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' +
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

    if (!res.ok) {
      const local = searchLocalFaq(prompt);
      if (local) {
        return {
          success: true,
          text: local,
          source: LOCAL_FAQ_SOURCE,
          sourceLabel: LOCAL_FAQ_SOURCE + ' (Gemini غير متاح)',
          sourceType: 'local_guidance',
          model: 'local-faq',
          externalAi: true,
          trusted: false,
        };
      }
      return { success: false, source: GEMINI_SOURCE, model: 'gemini-1.5-flash' };
    }

    const data = await res.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!replyText || replyText.length < 10) {
      return { success: false, source: GEMINI_SOURCE, model: 'gemini-1.5-flash' };
    }

    return {
      success: true,
      text: replyText,
      source: GEMINI_SOURCE,
      sourceLabel: GEMINI_SOURCE_LABEL,
      sourceType: 'external_ai',
      model: 'gemini-1.5-flash',
      externalAi: true,
      trusted: false,
    };
  } catch {
    const local = searchLocalFaq(prompt);
    if (local) {
      return {
        success: true,
        text: local,
        source: LOCAL_FAQ_SOURCE,
        sourceLabel: LOCAL_FAQ_SOURCE,
        sourceType: 'local_guidance',
        model: 'local-faq',
        externalAi: true,
        trusted: false,
      };
    }
    return { success: false, source: GEMINI_SOURCE, model: 'gemini-1.5-flash' };
  }
}

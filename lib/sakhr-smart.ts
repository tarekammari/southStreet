/**
 * Sakhr smart helpers — grounding, formatting, memory, reply safety.
 * Pure utilities; do not change public API response shapes.
 */

export const SAKHR_HISTORY_TURNS = 12;

export interface SakhrHistoryTurn {
  role: string;
  text: string;
}

/** Keep last N coherent turns (user+ai pairs preferred). */
export function normalizeSessionHistory(
  history: SakhrHistoryTurn[] | undefined | null,
  maxTurns = SAKHR_HISTORY_TURNS
): SakhrHistoryTurn[] {
  if (!Array.isArray(history) || history.length === 0) return [];
  const cleaned = history
    .filter((h) => h && typeof h.text === 'string' && h.text.trim().length > 0)
    .map((h) => ({
      role: h.role === 'user' || h.role === 'ai' || h.role === 'assistant' || h.role === 'model'
        ? h.role
        : 'user',
      text: String(h.text).trim().slice(0, 4000),
    }));
  return cleaned.slice(-maxTurns);
}

/** Patterns that must never appear in pilgrim-facing replies. */
const SECRET_LEAK_PATTERNS: RegExp[] = [
  /\b(GEMINI_API_KEY|SAKHR_GEMINI_KEY|XAI_API_KEY|GROK_API_KEY|POLLINATIONS_API_KEY)\b/gi,
  /\b(JWT_SECRET|DB_ENCRYPTION_SECRET|DB_LOOKUP_SECRET|SERVER_ENCRYPTION_KEY)\b/gi,
  /\b(SOUTHSTREET-KEY-[A-Za-z0-9\-]+)\b/gi,
  /\b(sk-[A-Za-z0-9]{20,})\b/g,
  /\b(AIza[0-9A-Za-z\-_]{20,})\b/g,
  /\b(xai-[A-Za-z0-9]{20,})\b/g,
  /Bearer\s+[A-Za-z0-9\-_\.]{20,}/gi,
  /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[^\s'"]{8,}/gi,
  /\.env\b/gi,
];

/** Strip env/secret material from AI replies before sending to clients. */
export function sanitizeSakhrReply(text: string): string {
  if (!text) return text;
  let out = text;
  for (const re of SECRET_LEAK_PATTERNS) {
    out = out.replace(re, '[محجوب]');
  }
  // Never echo admin key file hints
  out = out.replace(/southstreet_admin\.key/gi, '[ملف مفتاح محمي]');
  return out;
}

export function looksLikePriceQuestion(prompt: string): boolean {
  const n = (prompt || '').toLowerCase();
  const keys = [
    'سعر', 'اسعار', 'أسعار', 'ثمن', 'تكلفة', 'كم يكلف', 'كم سعر', 'price', 'cost',
    'باقة', 'باقات', 'عرض', 'عروض', 'package', 'offer',
  ];
  return keys.some((k) => n.includes(k));
}

/** Honest Arabic reply when prices/packages are unknown — never invent numbers. */
export function buildUnknownPriceResponse(agencyPhone?: string): {
  text: string;
  cards: [];
  actions: [];
  noKnowledge: true;
  trusted: true;
  externalAi: false;
  sourceType: 'agency_db';
  source: 'packages';
  sourceLabel: string;
} {
  const phone = agencyPhone || '+213 21 55 44 33';
  return {
    text:
      '💰 **بخصوص الأسعار:**\n\n' +
      'لا أملك حالياً أسعاراً معتمدة في قاعدة بيانات الوكالة لهذا الطلب، و**لن أختلق أرقاماً**.\n\n' +
      'هل تقصد:\n' +
      '1) باقة عمرة اقتصادية أم VIP؟\n' +
      '2) غرفة رباعية / ثلاثية / ثنائية؟\n' +
      '3) موسم معيّن (رمضان، صيف، حج)؟\n\n' +
      `📞 للاستفسار الفوري عن السعر المعتمد: **${phone}**`,
    cards: [],
    actions: [],
    noKnowledge: true,
    trusted: true,
    externalAi: false,
    sourceType: 'agency_db',
    source: 'packages',
    sourceLabel: 'باقات الوكالة (بدون سعر مخزّن)',
  };
}

/** Clarifying fallback when RAG / tools are empty. */
export function buildClarifyingFallback(prompt: string, agencyPhone?: string): {
  text: string;
  cards: [];
  actions: [];
  noKnowledge: true;
} {
  const phone = agencyPhone || '+213 21 55 44 33';
  const short = (prompt || '').trim().slice(0, 120);
  return {
    text:
      'عذراً، **لم أجد إجابة معتمدة** في معرفة الوكالة لسؤالك' +
      (short ? ` («${short}»)` : '') +
      '.\n\n' +
      'لكي أساعدك بدقة، وضّح لي واحداً مما يلي:\n' +
      '• هل تسأل عن **باقة / سعر / فندق / مرشد / حجز / عنوان الوكالة**؟\n' +
      '• أو عن **حكم شرعي عام** (محرم، إحرام، طواف)؟\n' +
      '• أو تريد **فتح صفحة** في التطبيق؟\n\n' +
      'مثال: «ما أسعار الباقة الاقتصادية؟» أو «افتح قسم الفنادق».\n\n' +
      `📞 للاستفسار المباشر: **${phone}**`,
    cards: [],
    actions: [],
    noKnowledge: true,
  };
}

export interface PackageLike {
  name?: string;
  type?: string;
  duration_days?: number;
  makkah_hotel_name?: string;
  madinah_hotel_name?: string;
  airline?: string;
  available?: boolean | number;
  prices?: Array<{ room_type?: string; amount?: number; currency?: string }>;
}

export interface HotelLike {
  name?: string;
  city?: string;
  distance_from_haram?: string;
  description?: string;
  services?: string | string[];
}

function roomTypeAr(rt?: string): string {
  const t = (rt || '').toUpperCase();
  if (t === 'QUAD' || t.includes('رباع')) return 'رباعية';
  if (t === 'TRIPLE' || t.includes('ثلاث')) return 'ثلاثية';
  if (t === 'DOUBLE' || t.includes('ثنائ')) return 'ثنائية';
  if (t === 'SINGLE' || t.includes('فرد')) return 'فردية';
  return rt || 'غرفة';
}

function fmtAmount(n?: number): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  return Math.round(n).toLocaleString('ar-DZ');
}

/** Clean markdown table-ish listing for packages when data exists. */
export function formatPackagesAnswer(packages: PackageLike[], intro?: string): string {
  if (!packages.length) {
    return 'لا توجد باقات معتمدة معروضة حالياً في قاعدة البيانات.';
  }
  let text =
    (intro || `📦 **باقات العمرة المعتمدة (${packages.length})**`) + '\n\n';
  packages.slice(0, 6).forEach((pkg, i) => {
    const prices = Array.isArray(pkg.prices) ? pkg.prices : [];
    const priced = prices.filter((p) => p && typeof p.amount === 'number' && (p.amount as number) > 0);
    text += `**${i + 1}. ${pkg.name || 'باقة'}**`;
    if (pkg.type) text += ` — ${pkg.type}`;
    text += '\n';
    if (pkg.duration_days) text += `• المدة: ${pkg.duration_days} يوم\n`;
    if (pkg.makkah_hotel_name) text += `• فندق مكة: ${pkg.makkah_hotel_name}\n`;
    if (pkg.madinah_hotel_name) text += `• فندق المدينة: ${pkg.madinah_hotel_name}\n`;
    if (pkg.airline) text += `• الخطوط: ${pkg.airline}\n`;
    if (priced.length) {
      text += '• الأسعار المعتمدة:\n';
      for (const p of priced) {
        const cur = p.currency || 'دج';
        text += `  – ${roomTypeAr(p.room_type)}: **${fmtAmount(p.amount)} ${cur}**\n`;
      }
    } else {
      text += '• السعر: **غير مُدرج بعد** (تواصل مع الوكالة للتسعير المعتمد)\n';
    }
    text += '\n';
  });
  text += '💡 اطلب «قارن الباقات» أو «احجز» للمتابعة.';
  return text.trim();
}

/** Clean listing for hotels when data exists. */
export function formatHotelsAnswer(hotels: HotelLike[], intro?: string): string {
  if (!hotels.length) {
    return 'لا توجد فنادق معتمدة في قاعدة البيانات حالياً.';
  }
  let text =
    (intro || `🏨 **فنادقنا المعتمدة (${hotels.length})**`) + '\n\n';
  hotels.slice(0, 8).forEach((h, i) => {
    text += `**${i + 1}. ${h.name || 'فندق'}**`;
    if (h.city) text += ` — ${h.city}`;
    text += '\n';
    if (h.distance_from_haram) text += `• البعد عن الحرم: ${h.distance_from_haram}\n`;
    if (h.description) text += `• ${String(h.description).slice(0, 160)}\n`;
    const svc = Array.isArray(h.services) ? h.services.join('، ') : h.services;
    if (svc) text += `• خدمات: ${String(svc).slice(0, 120)}\n`;
    text += '\n';
  });
  return text.trim();
}

/** Strengthen external-AI system rules (grounding + no invented prices). */
export function buildGroundedSystemExtras(): string {
  return (
    '\n5. إذا لم تتوفر أسعار/باقات من قاعدة الوكالة: صرّح بذلك واطلب توضيحاً — لا تخترع أسعاراً أبداً.\n' +
    '6. فضّل حقائق الوكالة (باقات، فنادق، مرشدين، عنوان) على التخمين.\n' +
    '7. لا تذكر مفاتيح API أو متغيرات .env أو ملفات المفاتيح الإدارية في الرد.\n' +
    '8. راعِ سياق المحادثة السابق إن وُجد، واسأل سؤالاً توضيحياً واحداً عند الغموض.'
  );
}

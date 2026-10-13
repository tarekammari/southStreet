import { GoogleGenAI } from '@google/genai';
import { normalizeQuestion } from '@/lib/sakhr/capacity';

/**
 * Internet search for agency staff, limited to trusted official sources.
 *
 * Engines, in order:
 *   1. Groq's built-in browser search on gpt-oss-120b (GROQ_API_KEY, free tier).
 *      One search per question, answered from the result summaries to stay
 *      inside the free limits. Accepted only when every page it found is on the
 *      trusted list.
 *   2. Google Search through Gemini, only with GEMINI_SEARCH=on (needs Gemini billing; free keys get 429),
 *      where only sentences backed by a trusted page are kept.
 * Either way: the query asks for the trusted sites only (site: filters), and an
 * answer from an unknown site is never passed on as fact ("not found" instead).
 * Free-tier budget: one search costs ~7-16k tokens of the model's ~200k/day, so
 * answers are kept for 24 h (official rules change slowly) and searches are
 * capped per day (SAKHR_WEB_SEARCH_DAILY, default 10): Sakhr's chat keeps its room.
 * Extra domains: SAKHR_TRUSTED_DOMAINS=example.gov.sa,other.dz
 */

const DEFAULT_TRUSTED: { domain: string; label: string }[] = [
  // Saudi Arabia, official
  { domain: 'haj.gov.sa', label: 'وزارة الحج والعمرة السعودية' },
  { domain: 'hajj.gov.sa', label: 'وزارة الحج والعمرة السعودية' },
  { domain: 'nusuk.sa', label: 'منصة نسك الرسمية' },
  { domain: 'moh.gov.sa', label: 'وزارة الصحة السعودية' },
  { domain: 'mofa.gov.sa', label: 'وزارة الخارجية السعودية (التأشيرات)' },
  { domain: 'gph.gov.sa', label: 'الهيئة العامة للعناية بشؤون المسجد الحرام والمسجد النبوي' },
  { domain: 'alharamain.gov.sa', label: 'رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي' },
  { domain: 'spa.gov.sa', label: 'وكالة الأنباء السعودية' },
  { domain: 'gaca.gov.sa', label: 'الهيئة العامة للطيران المدني السعودي' },
  { domain: 'my.gov.sa', label: 'البوابة الوطنية السعودية' },
  { domain: 'alifta.gov.sa', label: 'الرئاسة العامة للبحوث العلمية والإفتاء' },
  // Algeria, official
  { domain: 'onpo.dz', label: 'الديوان الوطني للحج والعمرة (الجزائر)' },
  { domain: 'marw.dz', label: 'وزارة الشؤون الدينية والأوقاف (الجزائر)' },
  { domain: 'aps.dz', label: 'وكالة الأنباء الجزائرية' },
  { domain: 'mae.gov.dz', label: 'وزارة الخارجية الجزائرية' },
  { domain: 'sante.gov.dz', label: 'وزارة الصحة الجزائرية' },
  { domain: 'airalgerie.dz', label: 'الخطوط الجوية الجزائرية' },
];

export function trustedSources(): { domain: string; label: string }[] {
  const extra = (process.env.SAKHR_TRUSTED_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^www\./, ''))
    .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))
    .map((domain) => ({ domain, label: domain }));
  return [...DEFAULT_TRUSTED, ...extra];
}

function trustedLabel(host: string): string | null {
  const h = host.toLowerCase().replace(/^www\./, '');
  const hit = trustedSources().find((s) => h === s.domain || h.endsWith(`.${s.domain}`));
  return hit ? hit.label : null;
}

/** Google returns redirect links: follow one hop to learn the real page. */
async function realUrl(uri: string): Promise<string> {
  try {
    const res = await fetch(uri, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(5000) });
    return res.headers.get('location') || uri;
  } catch {
    return uri;
  }
}

export type TrustedSearchResult =
  | { found: true; answer: string; sources: { title: string; url: string; publisher: string }[]; searched_at: string }
  | { found: false; reason: string; related_sources?: { title: string; url: string; publisher: string }[] };

const SEARCH_TIMEOUT_MS = 30_000;

const DAY_MS = 86_400_000;
const g = globalThis as unknown as { __ssWebSearch?: { cache: Map<string, { at: number; value: TrustedSearchResult }>; day: string; used: number } };
const state = (g.__ssWebSearch ||= { cache: new Map(), day: '', used: 0 });

function remembered(key: string): TrustedSearchResult | null {
  const hit = state.cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > DAY_MS) {
    state.cache.delete(key);
    return null;
  }
  return hit.value;
}

/** Counts a search against today's cap; false when the cap is reached. */
function takeSearch(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (state.day !== today) {
    state.day = today;
    state.used = 0;
  }
  const cap = Math.max(0, Number(process.env.SAKHR_WEB_SEARCH_DAILY ?? 10));
  if (state.used >= cap) return false;
  state.used += 1;
  return true;
}

/**
 * opts.scheduled: the every-3-days refresh (lib/sakhr/official-updates.ts) always
 * searches afresh and does not use staff's daily allowance.
 */
export async function trustedWebSearch(question: string, opts: { scheduled?: boolean } = {}): Promise<TrustedSearchResult> {
  const q = question.trim().slice(0, 400);
  if (!q) return { found: false, reason: 'empty question' };
  const key = `web:${normalizeQuestion(q)}`;
  const cached = opts.scheduled ? null : remembered(key);
  if (cached) return cached;
  if (!opts.scheduled && !takeSearch()) {
    return { found: false, reason: "Today's internet search limit is reached (free AI plan). Try again tomorrow, or check the official sites directly." };
  }

  let out: TrustedSearchResult | null = null;
  let lastError: unknown = null;
  // Gemini search needs billing on the key (free keys get 429): opt in with GEMINI_SEARCH=on.
  const engines = process.env.GEMINI_SEARCH?.trim() === 'on' ? [searchWithGroq, searchWithGemini] : [searchWithGroq];
  for (const engine of engines) {
    try {
      out = await engine(q);
      if (out) break;
    } catch (error) {
      lastError = error;
      console.warn(`[sakhr] trusted search via ${engine.name} failed`, (error as { status?: number })?.status ?? '');
    }
  }
  if (!out) {
    if (lastError) throw lastError;
    return { found: false, reason: 'Internet search is not set up (GROQ_API_KEY or GEMINI_API_KEY).' };
  }
  if (state.cache.size > 300) state.cache.delete(state.cache.keys().next().value as string);
  state.cache.set(key, { at: Date.now(), value: out });
  return out;
}

/**
 * Which trusted sites to search for a question. A short list (3-5 sites) keeps
 * the search engine inside it; one list for everything lets other sites in.
 */
const TOPICS: { match: RegExp; domains: string[] }[] = [
  { match: /لقاح|تطعيم|صح[ةي]|مرض|طبي|vaccin|health|covid|meningi/i, domains: ['moh.gov.sa', 'haj.gov.sa', 'nusuk.sa'] },
  { match: /تأشير|فيزا|visa|e-?visa|تصريح|permit/i, domains: ['nusuk.sa', 'mofa.gov.sa', 'haj.gov.sa', 'my.gov.sa'] },
  { match: /جزائر|الديوان الوطني|onpo|قرعة|الشؤون الدينية|algeri/i, domains: ['onpo.dz', 'marw.dz', 'aps.dz', 'mae.gov.dz'] },
  { match: /طيران|رحلة جوية|رحلات جوية|مطار|flight|airport|airline/i, domains: ['gaca.gov.sa', 'airalgerie.dz', 'haj.gov.sa'] },
  { match: /فتو|حكم|يجوز|مذهب|fatwa|ruling/i, domains: ['alifta.gov.sa', 'marw.dz'] },
  { match: /الحرم|المسجد النبوي|الروضة|الحرمين|haram|rawdah/i, domains: ['gph.gov.sa', 'alharamain.gov.sa', 'nusuk.sa'] },
];
const DEFAULT_DOMAINS = ['haj.gov.sa', 'nusuk.sa', 'spa.gov.sa', 'onpo.dz', 'marw.dz'];

export function domainsFor(q: string): string[] {
  const picked = new Set<string>();
  for (const t of TOPICS) if (t.match.test(q)) t.domains.forEach((d) => picked.add(d));
  const list = picked.size ? [...picked] : DEFAULT_DOMAINS;
  return list.slice(0, 6);
}

type Page = { title: string; url: string; content: string; publisher: string | null };

async function groqCall(apiKey: string, body: Record<string, unknown>) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || `Groq ${res.status}`), { status: res.status });
  return data;
}

/**
 * Groq browser search, in two steps so that only trusted text can reach the answer:
 *   1. search (and open the best pages) on the trusted sites for this topic;
 *   2. drop every page that is not on the trusted list, then write the answer
 *      from the remaining pages' text only (a plain call, no browsing).
 * Returns null when no Groq key is set.
 */
async function searchWithGroq(q: string): Promise<TrustedSearchResult | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;
  const domains = domainsFor(q);
  const search = await groqCall(apiKey, {
    model: process.env.GROQ_SEARCH_MODEL?.trim() || 'openai/gpt-oss-120b',
    reasoning_effort: 'low',
    tools: [{ type: 'browser_search' }],
    tool_choice: 'required',
    messages: [
      {
        role: 'user',
        content: `Search once, ONLY on ${domains.map((d) => `site:${d}`).join(' OR ')}, and open the most relevant official page. Then reply OK.\nQuestion: ${q}`,
      },
    ],
  });

  const pages: Page[] = [];
  for (const tool of search?.choices?.[0]?.message?.executed_tools || []) {
    for (const p of tool?.search_results?.results || []) {
      let host = '';
      try {
        host = new URL(String(p?.url || '')).hostname;
      } catch {
        /* not a URL */
      }
      pages.push({ title: String(p?.title || ''), url: String(p?.url || ''), content: String(p?.content || ''), publisher: trustedLabel(host) });
    }
  }
  const trusted = pages.filter((p) => p.publisher);
  const withText = trusted.filter((p) => p.content.trim().length > 200);
  const sources = trusted
    .filter((p, i, all) => all.findIndex((x) => x.url === p.url) === i)
    .slice(0, 6)
    .map((p) => ({ title: p.title || p.url, url: p.url, publisher: p.publisher as string }));

  if (!withText.length) {
    return sources.length
      ? { found: false, reason: 'Official pages were found but their text could not be read. Share these official links with the user.', related_sources: sources }
      : { found: false, reason: 'No trusted official source answered this question.' };
  }

  // Trusted text only, trimmed to stay inside the free per-minute limits.
  const excerpts = withText
    .slice(0, 3)
    .map((p, i) => `[${i + 1}] ${p.publisher} — ${p.url}\n${p.content.replace(/\s+/g, ' ').slice(0, 3500)}`)
    .join('\n\n');
  const answer = await groqCall(apiKey, {
    model: process.env.GROQ_SEARCH_ANSWER_MODEL?.trim() || 'openai/gpt-oss-20b',
    reasoning_effort: 'low',
    temperature: 0.1,
    max_completion_tokens: 900,
    messages: [
      {
        role: 'system',
        content:
          'You answer only from the official excerpts given, in Arabic, briefly, with dates and numbers exactly as written. Give everything the excerpts DO say that relates to the question, even if it answers only part of it, and say plainly which part the official pages do not cover. Mention when an excerpt looks old. Reply exactly NOT_FOUND only when the excerpts contain nothing related.',
      },
      { role: 'user', content: `Question: ${q}\n\nOfficial excerpts:\n${excerpts}` },
    ],
  });
  const text = String(answer?.choices?.[0]?.message?.content || '').replace(/【[^】]*】/g, '').trim();
  if (!text || text.includes('NOT_FOUND')) {
    return { found: false, reason: 'The official pages found do not answer this exactly. Share these official links with the user.', related_sources: sources };
  }
  return { found: true, answer: text.slice(0, 2500), sources, searched_at: new Date().toISOString() };
}

/** Google Search grounding through Gemini (needs billing on the key). Returns null when no key is set. */
async function searchWithGemini(q: string): Promise<TrustedSearchResult | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const prompt = [
    `Search the web ONLY on these official sites: ${domainsFor(q).map((d) => `site:${d}`).join(' OR ')}`,
    `Question (Hajj / Umrah, asked by staff of an Algerian travel agency): ${q}`,
    'Answer in Arabic with only facts stated on those sites, with dates and numbers exactly as published.',
    'Say when information may be out of date. If those sites do not answer the question, reply exactly: NOT_FOUND',
  ].join('\n');

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_SEARCH_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { tools: [{ googleSearch: {} }], temperature: 0.1, maxOutputTokens: 1500, abortSignal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) },
  });

  const text = (res.text || '').trim();
  const meta = res.candidates?.[0]?.groundingMetadata;
  const chunks = meta?.groundingChunks || [];
  if (!text || text.includes('NOT_FOUND') || !chunks.length) {
    return { found: false, reason: 'No trusted official source answered this question.' };
  }

  // Which sources are trusted, by their real address.
  const resolved = await Promise.all(
    chunks.slice(0, 10).map(async (c) => {
      const url = c.web?.uri ? await realUrl(c.web.uri) : '';
      let host = '';
      try {
        host = new URL(url).hostname;
      } catch {
        /* not a URL */
      }
      // The title is the site name when the redirect cannot be followed.
      const publisher = trustedLabel(host) || trustedLabel(c.web?.title || '');
      return { url, title: c.web?.title || host, publisher };
    })
  );
  const trusted = resolved.map((r) => Boolean(r.publisher));

  // Keep only the sentences Google says came from a trusted source.
  const supports = meta?.groundingSupports || [];
  let answer = '';
  if (supports.length) {
    const kept: string[] = [];
    for (const s of supports) {
      const seg = s.segment?.text?.trim();
      if (seg && (s.groundingChunkIndices || []).some((i) => trusted[i]) && !kept.includes(seg)) kept.push(seg);
    }
    answer = kept.join('\n');
  } else if (trusted.length && trusted.every(Boolean)) {
    answer = text;
  }

  const sources = resolved
    .filter((r) => r.publisher)
    .filter((r, i, all) => all.findIndex((x) => x.url === r.url) === i)
    .map((r) => ({ title: r.title, url: r.url, publisher: r.publisher as string }));

  return answer && sources.length
    ? { found: true, answer: answer.slice(0, 2500), sources: sources.slice(0, 6), searched_at: new Date().toISOString() }
    : { found: false, reason: 'Results came only from sources that are not on the trusted list, so they were not used.' };
}

import { getSqliteDb } from './sqlite';
import { Package, Hotel, Morshid, Season, AgencySettings } from '@/types';
import {
  searchAppContent,
  resolveNavigationTarget,
  getFullSiteInventory,
  buildSitemapContext,
  APP_PAGES,
} from './app-sitemap';

/**
 * TOOL 1: Search Packages in SQLite DB with filters (Budget, Season, Room type, Search query)
 */
export function toolSearchPackages(filters?: {
  query?: string;
  maxPrice?: number;
  roomType?: string;
  seasonId?: string;
}) {
  const db = getSqliteDb();
  let sql = `
    SELECT p.*, GROUP_CONCAT(pr.room_type || ':' || pr.amount) as price_list
    FROM packages p
    LEFT JOIN package_prices pr ON p.package_id = pr.package_id
    WHERE p.published = 1
  `;
  const params: any[] = [];

  if (filters?.seasonId) {
    sql += ` AND p.season_id = ?`;
    params.push(filters.seasonId);
  }

  if (filters?.query) {
    sql += ` AND (p.name LIKE ? OR p.description LIKE ? OR p.departure_city LIKE ?)`;
    const q = `%${filters.query}%`;
    params.push(q, q, q);
  }

  sql += ` GROUP BY p.package_id`;

  const rows = db.prepare(sql).all(...params) as any[];

  const priceRows = db.prepare('SELECT * FROM package_prices').all() as any[];

  let results = rows.map(p => {
    const prices = priceRows
      .filter(pr => pr.package_id === p.package_id)
      .map(pr => ({
        room_type: pr.room_type,
        traveler_type: pr.traveler_type,
        currency: pr.currency,
        amount: pr.amount
      }));

    return {
      package_id: p.package_id,
      name: p.name,
      type: p.type,
      season_name: p.season_name,
      description: p.description,
      duration_days: p.duration_days,
      departure_city: p.departure_city,
      airline: p.airline,
      makkah_hotel_name: p.makkah_hotel_name,
      makkah_hotel_dist: p.makkah_hotel_dist,
      madinah_hotel_name: p.madinah_hotel_name,
      available: p.available,
      capacity: p.capacity,
      prices,
      included_services: JSON.parse(p.included_services || '[]')
    };
  });

  if (filters?.maxPrice) {
    results = results.filter(p => p.prices.some(pr => pr.amount <= filters.maxPrice!));
  }

  return results;
}

/**
 * TOOL 2: Get Seasons info (Umrah / Hajj current and upcoming) from SQLite
 */
export function toolGetSeasonsInfo(type?: 'UMRAH' | 'HAJJ') {
  const db = getSqliteDb();
  let sql = `SELECT * FROM seasons`;
  const params: any[] = [];

  if (type) {
    sql += ` WHERE type = ?`;
    params.push(type);
  }

  sql += ` ORDER BY start_date ASC`;
  return db.prepare(sql).all(...params) as Season[];
}

/**
 * TOOL 3: Get Master Agency Settings from SQLite
 */
export function toolGetAgencySettings(): AgencySettings {
  const db = getSqliteDb();
  const row = db.prepare("SELECT * FROM agency_settings WHERE id = 'main'").get() as any;
  if (!row) {
    return {} as AgencySettings;
  }
  return {
    agency_name: row.agency_name,
    legal_name: row.legal_name,
    logo: row.logo,
    description: row.description,
    address: row.address,
    city: row.city,
    country: row.country,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    website: row.website,
    opening_hours: row.opening_hours,
    emergency_phone: row.emergency_phone,
    supported_languages: JSON.parse(row.supported_languages || '[]'),
    default_currency: row.default_currency,
    timezone: row.timezone
  };
}

/**
 * TOOL 4: Get Morshids & Staff Team Members from SQLite
 */
export function toolGetTeamMembers(category?: string, query?: string) {
  const db = getSqliteDb();
  let sql = `SELECT * FROM morshids WHERE 1=1`;
  const params: any[] = [];

  if (category) {
    sql += ` AND category = ?`;
    params.push(category);
  }

  if (query) {
    sql += ` AND (name LIKE ? OR specialization LIKE ? OR roleName LIKE ?)`;
    const q = `%${query}%`;
    params.push(q, q, q);
  }

  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(m => ({
    id: m.morshid_id,
    name: m.name,
    roleName: m.roleName,
    specialization: m.specialization,
    experience_years: m.experience_years,
    languages: JSON.parse(m.languages || '[]'),
    phone: m.phone,
    avatar: m.avatar,
    rating: m.rating,
    status: m.status,
    category: m.category,
    image: m.image
  }));
}

/**
 * TOOL 5: Get Hotel details & dist from SQLite
 */
export function toolGetHotelsInfo(city?: string, category?: string) {
  const db = getSqliteDb();
  let sql = `SELECT * FROM hotels WHERE status = 'ACTIVE'`;
  const params: any[] = [];

  if (city) {
    sql += ` AND city = ?`;
    params.push(city);
  }

  if (category) {
    sql += ` AND category = ?`;
    params.push(category);
  }

  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(h => ({
    hotel_id: h.hotel_id,
    name: h.name,
    city: h.city,
    category: h.category,
    address: h.address,
    distance_from_haram: h.distance_from_haram,
    description: h.description,
    services: JSON.parse(h.services || '[]'),
    images: JSON.parse(h.images || '[]')
  }));
}

/**
 * Normalize Arabic text for fuzzy matching
 */
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

const AR_STOP_WORDS = new Set([
  'هل', 'ما', 'من', 'في', 'على', 'عن', 'ان', 'إن', 'التي', 'الذي', 'هذا', 'هذه',
  'كيف', 'متى', 'اين', 'أين', 'لم', 'لن', 'قد', 'كان', 'the', 'is', 'are', 'do', 'does',
]);

function tokenizeQuery(prompt: string): string[] {
  return normalizeArabic(prompt)
    .split(/\s+/)
    .filter(w => w.length > 2 && !AR_STOP_WORDS.has(w));
}

/**
 * TOOL 6: Search Knowledge Base Rules in SQLite (enhanced Arabic matching)
 */
export function toolSearchKnowledge(prompt: string) {
  const db = getSqliteDb();
  const rows = db.prepare('SELECT * FROM ai_knowledge WHERE is_active = 1').all() as any[];
  const normalizedPrompt = normalizeArabic(prompt);
  const queryTokens = tokenizeQuery(prompt);

  let bestRule = null;
  let maxScore = 0;

  for (const rule of rows) {
    const keywords = JSON.parse(rule.keywords || '[]') as string[];
    const normalizedTitle = normalizeArabic(rule.title_ar);
    const normalizedResponse = normalizeArabic(rule.response_ar || '');
    let score = 0;

    for (const kw of keywords) {
      const cleanKw = normalizeArabic(kw);
      if (cleanKw.length > 1 && normalizedPrompt.includes(cleanKw)) {
        score += 18 + cleanKw.length;
      }
    }

    if (normalizedTitle && normalizedPrompt.includes(normalizedTitle)) {
      score += 35;
    }

    for (const token of queryTokens) {
      if (normalizedTitle.includes(token)) score += 12;
      if (normalizedResponse.includes(token)) score += 4;
      for (const kw of keywords) {
        if (normalizeArabic(kw).includes(token) || token.includes(normalizeArabic(kw))) {
          score += 10;
        }
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestRule = rule;
    }
  }

  if (bestRule && maxScore >= 10) {
    return {
      rule: {
        ...bestRule,
        keywords: JSON.parse(bestRule.keywords || '[]'),
      },
      score: maxScore,
    };
  }

  return null;
}

/**
 * TOOL 6b: Get all active knowledge rules from SQLite (for AI context injection)
 */
export function toolGetAllKnowledgeRules() {
  const db = getSqliteDb();
  const rows = db.prepare('SELECT * FROM ai_knowledge WHERE is_active = 1 ORDER BY category, title_ar').all() as any[];
  return rows.map(r => ({
    id: r.id,
    category: r.category,
    title_ar: r.title_ar,
    keywords: JSON.parse(r.keywords || '[]') as string[],
    response_ar: r.response_ar,
    modelAnswer: r.modelAnswer || null,
    answerMode: r.answerMode,
  }));
}

/**
 * Build compact knowledge context string for LLM
 */
export function toolBuildKnowledgeContext(): string {
  const rules = toolGetAllKnowledgeRules();
  if (!rules.length) return 'لا توجد قواعد معرفة مسجلة بعد.';
  return rules
    .map(r => `[${r.category}] ${r.title_ar}\nالكلمات: ${r.keywords.join('، ')}\nالإجابة: ${r.modelAnswer || r.response_ar}`)
    .join('\n\n---\n\n');
}

/**
 * TOOL 8: Search app pages & sections by user query
 */
export function toolSearchAppContent(query: string, topK = 5) {
  return searchAppContent(query, topK);
}

/**
 * TOOL 9: Resolve navigation target from natural language
 */
export function toolResolveNavigation(query: string) {
  return resolveNavigationTarget(query);
}

/**
 * TOOL 10: Full site inventory for AI context
 */
export function toolGetSiteInventory() {
  return getFullSiteInventory();
}

/**
 * TOOL 11: Compact sitemap string for LLM injection
 */
export function toolGetSitemapContext() {
  return buildSitemapContext();
}

/**
 * TOOL 12: Get page by id
 */
export function toolGetPageById(pageId: string) {
  return APP_PAGES.find(p => p.id === pageId) || null;
}

/**
 * TOOL 7: Compare Packages from SQLite
 */
export function toolComparePackages(packageIds: string[]) {
  if (!packageIds || packageIds.length === 0) return [];
  const db = getSqliteDb();

  const placeholders = packageIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM packages WHERE package_id IN (${placeholders})`)
    .all(...packageIds) as any[];

  const priceRows = db.prepare('SELECT * FROM package_prices').all() as any[];

  return rows.map(p => ({
    package_id: p.package_id,
    name: p.name,
    type: p.type,
    duration_days: p.duration_days,
    makkah_hotel_name: p.makkah_hotel_name,
    makkah_hotel_dist: p.makkah_hotel_dist,
    airline: p.airline,
    available: p.available,
    prices: priceRows
      .filter(pr => pr.package_id === p.package_id)
      .map(pr => ({ room_type: pr.room_type, amount: pr.amount, currency: pr.currency }))
  }));
}

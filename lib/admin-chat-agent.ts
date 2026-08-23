/**
 * Conversational admin CRUD over every SQLite table.
 *
 * Turns "أضف مرشد اسمه محمد الأمين" into a guided session that asks for the
 * remaining fields one question at a time, then writes the row. Kept
 * deterministic (no LLM round-trip) so a save never depends on model output.
 */

import { getColumnLabelAr } from './table-column-labels';
import { TABLE_LABELS_AR, TABLE_TERMS, normalizeArabic } from './admin-table-intent';

export type AdminOp = 'insert' | 'update' | 'delete';

export interface ColumnMeta {
  name: string;
  type: string;
  pk?: boolean;
  notnull?: boolean;
  hasDefault?: boolean;
  labelAr?: string;
}

export type SessionStage = 'pick_row' | 'pick_field' | 'collect' | 'offer_optional' | 'confirm';

export interface AdminSession {
  op: AdminOp;
  table: string;
  label: string;
  columns: ColumnMeta[];
  values: Record<string, string>;
  /** Fields still to ask about, in order */
  queue: string[];
  optional: string[];
  offeredOptional: boolean;
  current: string | null;
  stage: SessionStage;
  /** Rows offered in the numbered "which record?" list */
  candidates: Record<string, unknown>[];
  /** Full row set, kept so a retyped name can be searched again */
  allRows: Record<string, unknown>[];
  /** Value given inline ("...الى 0555") but not yet applied to a field */
  pendingValue: string | null;
  keyColumn: string | null;
  keyValue: unknown;
  rowLabel: string;
}

export interface ParsedCommand {
  op: AdminOp;
  table: string;
  label: string;
  raw: string;
  seed: Record<string, string>;
  rowQuery: string;
  field: string | null;
  fieldValue: string | null;
}

/* ────────────────────────────── word lists ────────────────────────────── */

const INSERT_WORDS = [
  'اضافة', 'إضافة', 'اضف', 'أضف', 'اضيف', 'أضيف', 'انشاء', 'إنشاء', 'انشئ', 'أنشئ',
  'تسجيل', 'add', 'new', 'create', 'insert',
];

const UPDATE_WORDS = [
  'تعديل', 'عدل', 'عدّل', 'تحديث', 'حدث', 'حدّث', 'تغيير', 'غير', 'غيّر', 'صحح',
  'edit', 'update', 'modify', 'change', 'set',
];

const DELETE_WORDS = [
  'حذف', 'احذف', 'امسح', 'مسح', 'ازالة', 'إزالة', 'ازل', 'أزل',
  'delete', 'remove', 'drop',
];

const YES_WORDS = [
  'نعم', 'ايه', 'اي', 'اجل', 'أجل', 'تمام', 'موافق', 'اوك', 'احفظ', 'حفظ', 'اكد', 'تاكيد',
  'اكمل', 'واصل', 'yes', 'y', 'ok', 'okay', 'sure', 'save', 'confirm',
];

const NO_WORDS = ['لا', 'كلا', 'ليس', 'مش', 'no', 'n', 'nope'];

const SKIP_WORDS = [
  'تخطي', 'تخط', 'تجاوز', 'لاحقا', 'لااعرف', 'لاعرف', 'فارغ', 'لاشيء', 'بدون',
  'skip', 'next', 'none', 'empty', '-',
];

const CANCEL_WORDS = ['الغاء', 'إلغاء', 'الغي', 'توقف', 'انسى', 'cancel', 'stop', 'abort'];

function hasWord(normalized: string, words: string[]): boolean {
  return words.some((w) => normalized.includes(normalizeArabic(w)));
}

function isExactly(text: string, words: string[]): boolean {
  const n = normalizeArabic(text).replace(/[.!?؟,،]/g, '').trim();
  return words.some((w) => n === normalizeArabic(w));
}

export function isYes(text: string): boolean {
  return isExactly(text, YES_WORDS) || hasWord(normalizeArabic(text), ['نعم', 'اكمل', 'احفظ', 'yes', 'ok']);
}

export function isNo(text: string): boolean {
  return isExactly(text, NO_WORDS);
}

export function isSkip(text: string): boolean {
  return isExactly(text, SKIP_WORDS);
}

export function isCancel(text: string): boolean {
  return isExactly(text, CANCEL_WORDS) || hasWord(normalizeArabic(text), CANCEL_WORDS);
}

/* ───────────────────────── field plans per table ───────────────────────── */

/** Curated ask-order. Packages have 32 columns; asking all of them would be cruel. */
const FIELD_PLAN: Record<string, { required: string[]; optional: string[] }> = {
  morshids: {
    required: ['name', 'roleName', 'phone'],
    optional: ['specialization', 'experience_years', 'languages', 'category', 'status', 'rating', 'image'],
  },
  hotels: {
    required: ['name', 'city', 'category'],
    optional: ['address', 'distance_from_haram', 'description', 'services', 'latitude', 'longitude', 'images', 'status'],
  },
  packages: {
    required: ['name', 'type', 'season_name', 'start_date', 'end_date'],
    optional: [
      'description', 'duration_days', 'departure_city', 'airline', 'makkah_hotel_name',
      'madinah_hotel_name', 'hotel_category', 'morshid_name', 'capacity', 'image_url', 'status',
    ],
  },
  users: {
    required: ['name', 'role'],
    optional: ['username', 'email', 'roleName', 'phone', 'status', 'room'],
  },
  seasons: {
    required: ['name', 'type', 'start_date', 'end_date'],
    optional: ['islamic_year', 'gregorian_year', 'status', 'description'],
  },
  ai_knowledge: {
    required: ['category', 'title_ar', 'response_ar'],
    optional: ['keywords', 'answerMode', 'matchStrategy'],
  },
  receipts: {
    required: ['pilgrimName', 'totalAmount', 'paidAmount'],
    optional: ['packageName', 'paymentMethod', 'date', 'accountantName'],
  },
  page_content: {
    required: ['content_key', 'content_ar'],
    optional: ['section'],
  },
  agency_settings: {
    required: ['agency_name'],
    optional: ['phone', 'email', 'website', 'address', 'opening_hours', 'emergency_phone'],
  },
};

/** Never ask for these — generated, hashed, or machine-owned. */
const SYSTEM_FIELDS = new Set([
  'createdAt', 'updatedAt', 'updatedBy', 'timestamp', 'passwordHash', 'pcFingerprint',
  'lastLoginIp', 'requiresFileKey', 'published', 'reserved', 'available', 'is_active',
  'usernameHash', 'emailHash', 'codeHash', 'qrSecretHash',
]);

const JSON_ARRAY_FIELDS = new Set([
  'languages', 'services', 'images', 'videos', 'keywords', 'supported_languages',
  'included_services', 'excluded_services', 'booking_conditions',
]);

const QUESTIONS: Record<string, string> = {
  username: 'ما اسم المستخدم للدخول؟',
  name: 'ما الاسم الكامل؟',
  agency_name: 'ما اسم الوكالة؟',
  roleName: 'ما المسمى الوظيفي؟',
  phone: 'ما رقم الهاتف؟',
  email: 'ما البريد الإلكتروني؟',
  role: 'ما الدور؟ (SUPER_ADMIN / AGENCY_MANAGER / ACCOUNTANT / GUIDE_MURSHID / AGENCY_AGENT / PILGRIM_USER)',
  specialization: 'ما التخصص أو نبذة مختصرة؟',
  experience_years: 'كم عدد سنوات الخبرة؟',
  languages: 'ما اللغات التي يتحدثها؟ (افصل بينها بفاصلة)',
  category: 'ما التصنيف؟',
  status: 'ما الحالة؟',
  rating: 'ما التقييم من 5؟',
  image: 'ما رابط الصورة؟ (أو اكتب "تخطي" ثم ارفعها من البطاقة)',
  image_url: 'ما رابط الصورة؟ (أو اكتب "تخطي")',
  images: 'ما روابط الصور؟ (افصل بينها بفاصلة، أو "تخطي")',
  city: 'في أي مدينة؟ (MAKKAH / MADINAH)',
  address: 'ما العنوان؟',
  distance_from_haram: 'كم المسافة عن الحرم؟',
  description: 'اكتب الوصف.',
  services: 'ما الخدمات المتوفرة؟ (افصل بينها بفاصلة)',
  latitude: 'ما خط العرض؟',
  longitude: 'ما خط الطول؟',
  type: 'ما النوع؟',
  season_name: 'ما اسم الموسم؟',
  start_date: 'ما تاريخ البداية؟ (YYYY-MM-DD)',
  end_date: 'ما تاريخ النهاية؟ (YYYY-MM-DD)',
  duration_days: 'كم عدد الأيام؟',
  departure_city: 'ما مدينة المغادرة؟',
  airline: 'ما شركة الطيران؟',
  makkah_hotel_name: 'ما فندق مكة؟',
  madinah_hotel_name: 'ما فندق المدينة؟',
  hotel_category: 'ما تصنيف الفندق؟',
  morshid_name: 'من المرشد المرافق؟',
  capacity: 'ما السعة (عدد المقاعد)؟',
  title_ar: 'ما عنوان السؤال؟',
  response_ar: 'ما الإجابة المعتمدة؟',
  keywords: 'ما الكلمات المفتاحية؟ (افصل بينها بفاصلة)',
  pilgrimName: 'ما اسم المعتمر؟',
  totalAmount: 'ما المبلغ الإجمالي؟',
  paidAmount: 'ما المبلغ المدفوع؟',
  paymentMethod: 'ما طريقة الدفع؟',
  content_key: 'ما مفتاح المحتوى؟',
  content_ar: 'ما نص المحتوى؟',
};

/** Extra synonyms so "رقمه" or "صورته" resolve to a column. */
const FIELD_SYNONYMS: Record<string, string[]> = {
  name: ['اسم', 'الاسم', 'اسمه', 'اسمها', 'name'],
  phone: ['هاتف', 'الهاتف', 'رقم', 'الرقم', 'تلفون', 'جوال', 'موبايل', 'phone', 'tel'],
  email: ['بريد', 'ايميل', 'email', 'mail'],
  roleName: ['وظيفة', 'الوظيفة', 'منصب', 'المنصب', 'مسمى', 'صفة'],
  image: ['صورة', 'الصورة', 'صورته', 'صورتها', 'photo', 'image'],
  image_url: ['صورة', 'الصورة', 'photo', 'image'],
  rating: ['تقييم', 'التقييم', 'نجوم', 'rating'],
  specialization: ['تخصص', 'التخصص', 'وصف', 'نبذة'],
  experience_years: ['خبرة', 'الخبرة', 'سنوات'],
  languages: ['لغة', 'لغات', 'اللغات', 'language'],
  status: ['حالة', 'الحالة', 'status'],
  category: ['تصنيف', 'التصنيف', 'فئة', 'category'],
  city: ['مدينة', 'المدينة', 'city'],
  address: ['عنوان', 'العنوان', 'address'],
  description: ['وصف', 'الوصف', 'description'],
  capacity: ['سعة', 'السعة', 'مقاعد', 'capacity'],
  start_date: ['تاريخ البداية', 'بداية', 'انطلاق'],
  end_date: ['تاريخ النهاية', 'نهاية', 'عودة'],
  airline: ['طيران', 'شركة الطيران', 'airline'],
  duration_days: ['مدة', 'المدة', 'ايام', 'أيام'],
  totalAmount: ['المبلغ الاجمالي', 'الاجمالي', 'total'],
  paidAmount: ['المدفوع', 'دفع', 'paid'],
};

const TITLE_COLUMNS = [
  'name', 'title_ar', 'agency_name', 'packageName', 'pilgrimName',
  'senderName', 'actorName', 'season_name', 'legal_name', 'content_key',
];

/* ───────────────────────────── command parsing ───────────────────────────── */

function detectTable(normalized: string): string | null {
  const scored = Object.entries(TABLE_TERMS)
    .map(([table, terms]) => ({
      table,
      score: terms.reduce((acc, t) => {
        const term = normalizeArabic(t);
        return normalized.includes(term) ? acc + term.length : acc;
      }, 0),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.length > 0 ? scored[0].table : null;
}

/** Pulls the value out of "اسمه محمد" / "name is Ali" / "«محمد»". */
function extractNamed(text: string): string {
  const quoted = text.match(/["'«"]([^"'»"]{2,})["'»"]/);
  if (quoted) return quoted[1].trim();

  const markers = [
    'اسمه الكامل', 'اسمها الكامل', 'الاسم الكامل',
    'اسمه', 'اسمها', 'الاسم', 'اسم', 'يسمى', 'تسمى', 'يدعى', 'تدعى',
    'name is', 'named', 'called', 'name',
  ];
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx === -1) continue;
    const after = text.slice(idx + marker.length).replace(/^[\s:=،,\-]+/, '').trim();
    if (after.length >= 2) return after;
  }
  return '';
}

/** Everything left after removing the verb and the table word. */
function extractRemainder(text: string, table: string): string {
  let out = ` ${text} `;
  const strip = [
    ...INSERT_WORDS, ...UPDATE_WORDS, ...DELETE_WORDS,
    ...(TABLE_TERMS[table] || []),
    'جديد', 'جديدة', 'الى', 'إلى', 'في', 'من', 'جدول', 'سطر', 'بيانات', 'الجدول',
    'row', 'record', 'table', 'to', 'in', 'the', 'a', 'an',
  ];
  // Run twice: replacing "\sword\s" consumes the separating space, so adjacent
  // stop-words ("الفندق دار") need a second pass.
  for (let pass = 0; pass < 2; pass++) {
    for (const word of strip) {
      out = out.replace(stopWordPattern(word), ' ');
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Arabic glues the article and prepositions onto words: مرشد / المرشد / للمرشد. */
const PROCLITICS = '(?:لل|بال|وال|كال|فال|ال|ل|ب|و|ف)?';

function stopWordPattern(word: string): RegExp {
  return new RegExp(`\\s${PROCLITICS}${escapeRegex(word)}\\s`, 'gi');
}

/** Finds which column the admin is referring to ("عدل الهاتف..."). */
export function matchField(text: string, columns: ColumnMeta[]): string | null {
  const n = normalizeArabic(text);
  let best: { name: string; score: number } | null = null;

  for (const col of columns) {
    if (col.pk) continue;
    const candidates = [
      col.name.replace(/_/g, ' '),
      getColumnLabelAr(col.name),
      ...(FIELD_SYNONYMS[col.name] || []),
    ];
    for (const cand of candidates) {
      const term = normalizeArabic(cand);
      if (term.length < 3) continue;
      if (n.includes(term) && (!best || term.length > best.score)) {
        best = { name: col.name, score: term.length };
      }
    }
  }
  return best?.name ?? null;
}

function extractNewValue(text: string): string {
  const markers = [' الى ', ' إلى ', ' يصبح ', ' ليصبح ', ' تصبح ', ' = ', ' to ', ' into '];
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      const after = text.slice(idx + marker.length).trim();
      if (after.length >= 1) return after;
    }
  }
  return '';
}

export function parseAdminCommand(text: string): ParsedCommand | null {
  const raw = text.trim();
  if (!raw) return null;
  const n = normalizeArabic(raw);

  let op: AdminOp | null = null;
  if (hasWord(n, DELETE_WORDS)) op = 'delete';
  else if (hasWord(n, UPDATE_WORDS)) op = 'update';
  else if (hasWord(n, INSERT_WORDS)) op = 'insert';
  if (!op) return null;

  const table = detectTable(n);
  if (!table) return null;

  const named = extractNamed(raw);
  const remainder = extractRemainder(raw, table);
  const subject = named || remainder;

  if (op === 'insert') {
    const seed: Record<string, string> = {};
    if (subject) seed.name = subject;
    return {
      op, table, label: TABLE_LABELS_AR[table] || table, raw,
      seed, rowQuery: '', field: null, fieldValue: null,
    };
  }

  const newValue = extractNewValue(raw);
  // "عدل هاتف سارة الى X" — drop the value part before reading the row name
  const beforeValue = newValue ? raw.slice(0, raw.length - newValue.length) : raw;
  const rowQuery = named || extractRemainder(beforeValue, table);

  return {
    op,
    table,
    label: TABLE_LABELS_AR[table] || table,
    raw,
    seed: {},
    rowQuery: rowQuery.replace(/[.!؟?]+$/, '').trim(),
    field: null,
    fieldValue: newValue || null,
  };
}

/**
 * Splits an edit/delete command into the field being changed and the words that
 * identify the row, so "عدّل هاتف سارة" doesn't search for a record named "هاتف سارة".
 */
export function resolveMutation(
  cmd: ParsedCommand,
  columns: ColumnMeta[]
): { field: string | null; rowQuery: string } {
  if (cmd.op === 'delete') return { field: null, rowQuery: cmd.rowQuery };

  const field = matchField(cmd.raw, columns);
  if (!field) return { field: null, rowQuery: cmd.rowQuery };

  let rowQuery = ` ${cmd.rowQuery} `;
  const words = [
    field.replace(/_/g, ' '),
    getColumnLabelAr(field),
    ...(FIELD_SYNONYMS[field] || []),
  ];
  for (let pass = 0; pass < 2; pass++) {
    for (const word of words) {
      const term = word.trim();
      if (term.length < 3) continue;
      rowQuery = rowQuery.replace(stopWordPattern(term), ' ');
    }
  }

  return { field, rowQuery: rowQuery.replace(/\s+/g, ' ').trim() };
}

/* ───────────────────────────── session building ───────────────────────────── */

function planFor(table: string, columns: ColumnMeta[]): { required: string[]; optional: string[] } {
  const present = new Set(columns.map((c) => c.name));
  const plan = FIELD_PLAN[table];

  if (plan) {
    return {
      required: plan.required.filter((f) => present.has(f)),
      optional: plan.optional.filter((f) => present.has(f)),
    };
  }

  const askable = columns.filter((c) => !c.pk && !SYSTEM_FIELDS.has(c.name));
  return {
    required: askable.filter((c) => c.notnull && !c.hasDefault).map((c) => c.name),
    optional: askable.filter((c) => !(c.notnull && !c.hasDefault)).map((c) => c.name),
  };
}

export function createInsertSession(cmd: ParsedCommand, label: string, columns: ColumnMeta[]): AdminSession {
  const { required, optional } = planFor(cmd.table, columns);
  const values: Record<string, string> = {};

  for (const [field, value] of Object.entries(cmd.seed)) {
    if (columns.some((c) => c.name === field)) values[field] = value;
  }

  return {
    op: 'insert',
    table: cmd.table,
    label,
    columns,
    values,
    queue: required.filter((f) => !values[f]),
    optional: optional.filter((f) => !values[f]),
    offeredOptional: false,
    current: null,
    stage: 'collect',
    candidates: [],
    allRows: [],
    pendingValue: null,
    keyColumn: null,
    keyValue: null,
    rowLabel: '',
  };
}

export function createMutateSession(
  cmd: ParsedCommand,
  label: string,
  columns: ColumnMeta[],
  rows: Record<string, unknown>[]
): AdminSession {
  return {
    op: cmd.op,
    table: cmd.table,
    label,
    columns,
    values: {},
    queue: [],
    optional: [],
    offeredOptional: true,
    current: cmd.field,
    stage: 'pick_row',
    candidates: [],
    allRows: rows,
    pendingValue: cmd.fieldValue,
    keyColumn: null,
    keyValue: null,
    rowLabel: '',
  };
}

export function rowTitle(row: Record<string, unknown>, columns: ColumnMeta[]): string {
  for (const col of TITLE_COLUMNS) {
    const v = row[col];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  const pk = columns.find((c) => c.pk);
  return pk ? String(row[pk.name] ?? 'سجل') : 'سجل';
}

export function matchRows(
  rows: Record<string, unknown>[],
  query: string,
  columns: ColumnMeta[]
): Record<string, unknown>[] {
  const q = normalizeArabic(query);
  if (!q || q.length < 2) return [];

  const titled = rows.map((row) => ({ row, title: normalizeArabic(rowTitle(row, columns)) }));

  const exact = titled.filter((t) => t.title === q);
  if (exact.length > 0) return exact.map((t) => t.row);

  // Either direction: the admin typed part of the name, or wrapped it in a sentence
  const contained = titled.filter(
    (t) => t.title.length >= 3 && (t.title.includes(q) || q.includes(t.title))
  );
  if (contained.length > 0) return contained.map((t) => t.row);

  // Most of the record's name shows up among the words the admin used
  const words = new Set(q.split(' ').filter((w) => w.length >= 3));
  const scored = titled
    .map((t) => {
      const tokens = t.title.split(' ').filter((w) => w.length >= 3);
      const hits = tokens.filter((w) => words.has(w)).length;
      return { row: t.row, hits, score: tokens.length > 0 ? hits / tokens.length : 0 };
    })
    .filter((t) => t.hits > 0 && t.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    const best = scored[0].score;
    return scored.filter((t) => t.score === best).map((t) => t.row);
  }

  return rows.filter((r) =>
    Object.values(r).some((v) => typeof v === 'string' && normalizeArabic(v).includes(q))
  );
}

export function selectRow(session: AdminSession, row: Record<string, unknown>): AdminSession {
  const pk = session.columns.find((c) => c.pk);
  const next: AdminSession = {
    ...session,
    candidates: [],
    keyColumn: pk?.name ?? null,
    keyValue: pk ? row[pk.name] : null,
    rowLabel: rowTitle(row, session.columns),
  };

  if (session.op === 'delete') return { ...next, stage: 'confirm' };

  if (next.current) {
    const collecting: AdminSession = { ...next, stage: 'collect' };
    if (next.pendingValue) {
      return applyAnswer({ ...collecting, pendingValue: null }, next.pendingValue);
    }
    return collecting;
  }

  return { ...next, stage: 'pick_field' };
}

/** Moves to the next question, or to the confirmation step. */
export function nextStep(session: AdminSession): AdminSession {
  if (session.queue.length > 0) {
    const [head, ...rest] = session.queue;
    return { ...session, current: head, queue: rest, stage: 'collect' };
  }
  if (session.op === 'insert' && !session.offeredOptional && session.optional.length > 0) {
    return { ...session, current: null, stage: 'offer_optional' };
  }
  return { ...session, current: null, stage: 'confirm' };
}

export function acceptOptional(session: AdminSession, wanted: boolean): AdminSession {
  const next: AdminSession = {
    ...session,
    offeredOptional: true,
    queue: wanted ? session.optional : [],
    optional: [],
  };
  return nextStep(next);
}

export function applyAnswer(session: AdminSession, text: string): AdminSession {
  if (!session.current) return session;
  const field = session.current;
  const skipped = isSkip(text);
  const values = { ...session.values };
  if (!skipped) values[field] = text.trim();

  return nextStep({ ...session, values, current: null });
}

export function setEditField(session: AdminSession, field: string): AdminSession {
  const staged: AdminSession = { ...session, current: field, stage: 'collect', queue: [] };
  if (session.pendingValue) {
    return applyAnswer({ ...staged, pendingValue: null }, session.pendingValue);
  }
  return staged;
}

/* ───────────────────────────── prompt rendering ───────────────────────────── */

export function questionFor(field: string): string {
  return QUESTIONS[field] || `ما ${getColumnLabelAr(field)}؟`;
}

function shownValue(session: AdminSession, field: string): string {
  const raw = session.values[field];
  return raw === undefined || raw === '' ? '—' : raw;
}

export function summaryOf(session: AdminSession): string {
  if (session.op === 'delete') {
    return `**حذف من ${session.label}**\n• ${session.rowLabel}`;
  }

  if (session.op === 'update') {
    const field = Object.keys(session.values)[0];
    return [
      `**تعديل في ${session.label}**`,
      `• السجل: ${session.rowLabel}`,
      field ? `• ${getColumnLabelAr(field)}: ${session.values[field]}` : '',
    ].filter(Boolean).join('\n');
  }

  const filled = Object.keys(session.values).filter((f) => session.values[f] !== '');
  const lines = filled.map((f) => `• ${getColumnLabelAr(f)}: ${shownValue(session, f)}`);
  return [`**إضافة إلى ${session.label}**`, ...lines].join('\n');
}

export function promptFor(session: AdminSession): string {
  switch (session.stage) {
    case 'pick_row': {
      if (session.candidates.length === 0) {
        return `لم أجد هذا السجل في ${session.label}. اكتب الاسم كما هو مسجّل، أو "إلغاء".`;
      }
      const list = session.candidates
        .slice(0, 8)
        .map((r, i) => `${i + 1}. ${rowTitle(r, session.columns)}`)
        .join('\n');
      const verb = session.op === 'delete' ? 'حذفه' : 'تعديله';
      return `أي سجل تريد ${verb}؟ اكتب الرقم.\n\n${list}`;
    }

    case 'pick_field': {
      const plan = planFor(session.table, session.columns);
      const fields = [...plan.required, ...plan.optional].slice(0, 10);
      const list = fields.map((f) => `• ${getColumnLabelAr(f)}`).join('\n');
      return `**${session.rowLabel}** — أي حقل تريد تعديله؟\n\n${list}`;
    }

    case 'collect': {
      const total = Object.keys(session.values).length + session.queue.length + 1;
      const step = Object.keys(session.values).length + 1;
      const counter = session.op === 'insert' ? ` (${step}/${total})` : '';
      return `${questionFor(session.current || '')}${counter}`;
    }

    case 'offer_optional':
      return `سجّلت الأساسيات. هل تريد إضافة تفاصيل أخرى (${session.optional.length} حقل)؟ **نعم** أو **لا**.`;

    case 'confirm':
      return `${summaryOf(session)}\n\nأحفظ الآن؟ **نعم** أو **لا**.`;

    default:
      return '';
  }
}

export function openingLine(session: AdminSession): string {
  const verb = session.op === 'insert' ? 'إضافة سجل جديد إلى' : session.op === 'update' ? 'تعديل' : 'حذف من';
  return `${verb} **${session.label}**. اكتب "إلغاء" للتوقف${session.op === 'insert' ? '، أو "تخطي" لتجاوز أي حقل' : ''}.`;
}

/* ───────────────────────────── save payload ───────────────────────────── */

function coerce(field: string, value: string, columns: ColumnMeta[]): string | number {
  const col = columns.find((c) => c.name === field);
  const trimmed = value.trim();

  if (JSON_ARRAY_FIELDS.has(field)) {
    const parts = trimmed.split(/[,،]+/).map((p) => p.trim()).filter(Boolean);
    return JSON.stringify(parts);
  }

  const type = (col?.type || 'TEXT').toUpperCase();
  if (type === 'INTEGER' || type === 'REAL') {
    const num = parseFloat(trimmed.replace(/[^\d.\-]/g, ''));
    if (Number.isFinite(num)) return type === 'INTEGER' ? Math.round(num) : num;
  }

  return trimmed;
}

const PK_PREFIX: Record<string, string> = {
  morshids: 'msh',
  hotels: 'htl',
  packages: 'pkg',
  seasons: 'ssn',
  users: 'usr',
  ai_knowledge: 'rule',
  receipts: 'rcp',
  page_content: 'pc',
};

export function buildPayload(session: AdminSession): Record<string, string | number> {
  const payload: Record<string, string | number> = {};

  for (const [field, value] of Object.entries(session.values)) {
    if (value === '' || value === undefined) continue;
    payload[field] = coerce(field, value, session.columns);
  }

  if (session.op !== 'insert') return payload;

  const pk = session.columns.find((c) => c.pk);
  if (pk && !payload[pk.name]) {
    const prefix = PK_PREFIX[session.table] || session.table.slice(0, 3);
    payload[pk.name] = `${prefix}_${Date.now()}`;
  }

  const now = new Date().toISOString();
  for (const stamp of ['createdAt', 'updatedAt']) {
    if (session.columns.some((c) => c.name === stamp) && !payload[stamp]) payload[stamp] = now;
  }
  if (session.columns.some((c) => c.name === 'avatar') && !payload.avatar && session.values.name) {
    payload.avatar = session.values.name.trim().charAt(0);
  }

  return payload;
}

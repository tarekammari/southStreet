/**
 * Decides what the expanded record card shows, in what order, and how each value
 * is rendered. Identifiers, timestamps and empty columns move behind a disclosure
 * so the card reads like a profile instead of a raw table row.
 */

import { formatSelectDisplay, getFieldSelectOptions, isMultiSelectField } from './record-field-options';
import { getColumnLabelAr } from './table-column-labels';
import {
  isAvatarInitial,
  isImageColumnName,
  isImagesArrayColumn,
  isImageUploadColumn,
  isLongTextColumn,
} from './table-cell-utils';
import type { RecordColumn } from './record-card';

export type FieldKind = 'text' | 'longtext' | 'chips' | 'ltr' | 'boolean' | 'media' | 'select';

export interface DetailField {
  name: string;
  label: string;
  kind: FieldKind;
  /** Ready-to-render text for every kind except `chips` */
  text: string;
  chips: string[];
  empty: boolean;
  isKey: boolean;
  /** Spans the full width of the grid */
  full: boolean;
}

export interface DetailLayout {
  primary: DetailField[];
  secondary: DetailField[];
}

/** Reading order: who/what first, then contact, dates, figures, and prose last. */
const DISPLAY_ORDER = [
  'name', 'title_ar', 'agency_name', 'packageName', 'pilgrimName', 'legal_name', 'content_key',
  'username', 'roleName', 'role', 'type', 'category', 'hotel_category', 'city', 'section', 'status',
  'phone', 'whatsapp', 'emergency_phone', 'email', 'website', 'address',
  'season_name', 'start_date', 'end_date', 'date', 'opening_hours',
  'duration_days', 'departure_city', 'airline',
  'makkah_hotel_name', 'madinah_hotel_name', 'morshid_name', 'distance_from_haram',
  'rating', 'experience_years', 'capacity',
  'totalAmount', 'paidAmount', 'remainingAmount', 'paymentMethod', 'accountantName',
  'languages', 'supported_languages', 'services', 'included_services', 'excluded_services',
  'keywords', 'booking_conditions',
  'specialization', 'description', 'response_ar', 'content_ar', 'details', 'text', 'action',
];

/** Machine-owned columns: real data, but not what a human opens the card to read. */
const TECHNICAL_FIELDS = new Set([
  'avatar', 'createdAt', 'updatedAt', 'updatedBy', 'timestamp', 'passwordHash',
  'pcFingerprint', 'lastLoginIp', 'requiresFileKey', 'ip', 'chatId', 'senderId',
  'senderRole', 'published', 'reserved', 'is_active', 'latitude', 'longitude',
  'answerMode', 'matchStrategy', 'timezone', 'default_currency',
  'review_count', 'usernameHash', 'emailHash', 'codeHash', 'qrSecretHash', 'loginEnabled',
]);

/** Staff profiles use التصنيف instead of a free-text الحالة badge. */
const OMITTED_BY_TABLE: Record<string, Set<string>> = {
  morshids: new Set(['status']),
};

function isOmitted(column: RecordColumn, tableName?: string): boolean {
  if (!tableName) return false;
  return OMITTED_BY_TABLE[tableName]?.has(column.name) ?? false;
}

const LTR_FIELDS = new Set([
  'phone', 'whatsapp', 'emergency_phone', 'email', 'website', 'pilgrimCode', 'code',
  'username', 'latitude', 'longitude', 'ip', 'lastLoginIp',
]);

const MONEY_FIELDS = new Set(['totalAmount', 'paidAmount', 'remainingAmount', 'amount', 'price']);

function isIdentifier(name: string): boolean {
  return /^id$|_id$|_key$/i.test(name);
}

function isTechnical(column: RecordColumn, keyColumn: string | null): boolean {
  return (
    Boolean(column.pk) ||
    column.name === keyColumn ||
    TECHNICAL_FIELDS.has(column.name) ||
    isIdentifier(column.name)
  );
}

/** JSON-encoded lists (`["العربية","الفرنسية"]`) become chips instead of raw text. */
export function parseChips(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
  } catch {
    return null;
  }
  return null;
}

function formatNumber(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toLocaleString('ar-DZ');
}

function buildField(
  column: RecordColumn,
  raw: unknown,
  keyColumn: string | null,
  tableName?: string
): DetailField {
  const label = column.labelAr || getColumnLabelAr(column.name);
  const isKey = Boolean(column.pk) || column.name === keyColumn;
  const empty = raw === null || raw === undefined || String(raw).trim() === '';

  const asString = empty ? '' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw).trim();
  const chips = empty ? null : parseChips(raw);

  if (chips) {
    return {
      name: column.name,
      label,
      kind: 'chips',
      text: '',
      chips,
      empty: chips.length === 0,
      isKey,
      full: chips.length > 3 || chips.some((c) => c.length > 24),
    };
  }

  const mediaValue =
    (isImageUploadColumn(column.name) || isImageColumnName(column.name) || isImagesArrayColumn(column.name)) &&
    !isAvatarInitial(column.name, asString);

  const selectOptions = getFieldSelectOptions(column.name, tableName);
  const isSelect = Boolean(selectOptions && !isMultiSelectField(column.name));

  let kind: FieldKind = 'text';
  if (mediaValue) kind = 'media';
  else if (isSelect) kind = 'select';
  else if (typeof raw === 'boolean' || (column.type || '').toUpperCase() === 'BOOLEAN') kind = 'boolean';
  else if (isLongTextColumn(column.name) || asString.length > 90) kind = 'longtext';
  else if (LTR_FIELDS.has(column.name)) kind = 'ltr';

  let text = asString;
  if (kind === 'boolean') text = asString === '1' || asString.toLowerCase() === 'true' ? 'نعم' : 'لا';
  else if (kind === 'select') text = formatSelectDisplay(column.name, asString, tableName);
  else if (MONEY_FIELDS.has(column.name) && asString) text = `${formatNumber(asString)} دج`;

  return {
    name: column.name,
    label,
    kind,
    text,
    chips: [],
    empty,
    isKey,
    full: kind === 'longtext' || kind === 'media',
  };
}

/** Stable sort keeps unlisted columns in their table order, after the known ones. */
function orderColumns(columns: RecordColumn[]): RecordColumn[] {
  const rank = (name: string) => {
    const i = DISPLAY_ORDER.indexOf(name);
    return i === -1 ? DISPLAY_ORDER.length : i;
  };
  return [...columns].sort((a, b) => rank(a.name) - rank(b.name));
}

export function buildDetailLayout(
  row: Record<string, unknown>,
  columns: RecordColumn[],
  keyColumn: string | null,
  mode: 'view' | 'edit' = 'view',
  tableName?: string
): DetailLayout {
  const primary: DetailField[] = [];
  const secondary: DetailField[] = [];

  for (const column of orderColumns(columns)) {
    if (isOmitted(column, tableName)) continue;

    const field = buildField(column, row[column.name], keyColumn, tableName);

    // Photos live in the hero slider, so they'd be duplicated noise when reading
    if (field.kind === 'media' && mode === 'view') continue;

    // While editing, empty fields are the ones you came to fill in
    const hidden = isTechnical(column, keyColumn) || (mode === 'view' && field.empty);
    (hidden ? secondary : primary).push(field);
  }

  return { primary, secondary };
}

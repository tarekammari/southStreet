import { extractImageUrls, isImageColumnName, isImagesArrayColumn } from './table-cell-utils';
import { getColumnLabelAr } from './table-column-labels';

export interface RecordColumn {
  name: string;
  type: string;
  pk?: boolean;
  labelAr?: string;
}

export interface RecordCardModel {
  key: string;
  /** Primary key column + value, used to save edits back to SQLite */
  keyColumn: string | null;
  keyValue: unknown;
  title: string;
  subtitle: string;
  phone: string;
  rating: string;
  image: string;
  initial: string;
  /** Lowercased haystack used for instant filtering */
  search: string;
  row: Record<string, unknown>;
}

const TITLE_COLUMNS = [
  'name', 'title_ar', 'agency_name', 'packageName', 'pilgrimName',
  'senderName', 'actorName', 'season_name', 'legal_name', 'content_key',
];

const SUBTITLE_COLUMNS = [
  'roleName', 'specialization', 'category', 'city', 'season_name',
  'action', 'section', 'hotel_category', 'type', 'departure_city',
];

const PHONE_COLUMNS = ['phone', 'whatsapp', 'emergency_phone', 'pilgrimCode', 'code', 'email'];
const RATING_COLUMNS = ['rating', 'experience_years', 'duration_days', 'capacity'];

function firstNonEmpty(row: Record<string, unknown>, candidates: string[], names: Set<string>): string {
  for (const c of candidates) {
    if (!names.has(c)) continue;
    const v = row[c];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function ratingText(row: Record<string, unknown>, names: Set<string>): string {
  if (names.has('rating') && row.rating != null && String(row.rating).trim() !== '') {
    return `★ ${row.rating}`;
  }
  for (const c of RATING_COLUMNS) {
    if (!names.has(c) || row[c] == null || String(row[c]).trim() === '') continue;
    if (c === 'experience_years') return `${row[c]} سنة خبرة`;
    if (c === 'duration_days') return `${row[c]} يوم`;
    if (c === 'capacity') return `سعة ${row[c]}`;
  }
  return '';
}

export function buildRecordCard(
  row: Record<string, unknown>,
  columns: RecordColumn[],
  index: number
): RecordCardModel {
  const names = new Set(columns.map((c) => c.name));
  const pkCol = columns.find((c) => c.pk);
  const keyColumn = pkCol?.name ?? null;
  const keyValue = keyColumn ? row[keyColumn] : undefined;
  const key = keyColumn && keyValue != null ? `${keyColumn}:${keyValue}` : `idx:${index}`;

  let image = '';
  for (const col of columns) {
    if (image) break;
    if (isImageColumnName(col.name) || isImagesArrayColumn(col.name)) {
      image = extractImageUrls(row[col.name], col.name)[0] || '';
    }
  }

  const title =
    firstNonEmpty(row, TITLE_COLUMNS, names) ||
    (keyValue != null ? String(keyValue) : '') ||
    'سجل بدون عنوان';

  const rawAvatar = row['avatar'];
  const initial =
    typeof rawAvatar === 'string' && rawAvatar.trim().length > 0 && rawAvatar.trim().length <= 3
      ? rawAvatar.trim()
      : title.charAt(0);

  return {
    key,
    keyColumn,
    keyValue,
    title,
    subtitle: firstNonEmpty(row, SUBTITLE_COLUMNS, names),
    phone: firstNonEmpty(row, PHONE_COLUMNS, names),
    rating: ratingText(row, names),
    image,
    initial,
    search: JSON.stringify(row).toLowerCase(),
    row,
  };
}

export function fieldLabel(column: RecordColumn): string {
  return column.labelAr || getColumnLabelAr(column.name);
}

const ID_PREFIX: Record<string, string> = {
  morshids: 'msh',
  hotels: 'htl',
  packages: 'pkg',
  users: 'usr',
  seasons: 'ssn',
  receipts: 'rcp',
  messages: 'msg',
  reviews: 'rev',
};

export function generateRecordId(tableName: string): string {
  const prefix = ID_PREFIX[tableName] || tableName;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Empty profile used by the "add new" window — same card as edit, blank fields. */
export function emptyRecordCard(columns: RecordColumn[], tableName: string): RecordCardModel {
  const row: Record<string, unknown> = {};
  const pk = columns.find((c) => c.pk);
  const id = generateRecordId(tableName);
  for (const col of columns) row[col.name] = '';
  if (pk) row[pk.name] = id;
  if (tableName === 'morshids') {
    row.category = 'religious_guide';
    row.languages = JSON.stringify(['العربية']);
  }
  const card = buildRecordCard(row, columns, -1);
  return {
    ...card,
    key: '__new__',
    title: 'إضافة جديد',
    keyValue: pk ? id : null,
  };
}

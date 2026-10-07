/**
 * Package service/condition columns are meant to hold a JSON array, but older rows
 * (and some admin write paths) stored free text instead. A single bad row used to throw
 * from JSON.parse and fail the whole packages endpoint, so parsing stays tolerant here.
 */
export function parsePackageList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  if (raw === null || raw === undefined) return [];

  const text = String(raw).trim();
  if (!text) return [];

  if (text.startsWith('[') || text.startsWith('{') || text.startsWith('"')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
      if (typeof parsed === 'string') return splitFreeText(parsed);
      if (parsed && typeof parsed === 'object') return Object.values(parsed).map(String).filter(Boolean);
      return [];
    } catch {
      /* fall through to free-text handling */
    }
  }

  return splitFreeText(text);
}

function splitFreeText(text: string): string[] {
  return text
    .split(/\r?\n|·|;|,/)
    .map((part) => part.trim())
    .filter(Boolean);
}

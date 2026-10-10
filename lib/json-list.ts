/**
 * List columns (services, images, languages, keywords…) are stored as JSON
 * arrays, but rows added from the table editor or by Sakhr can hold plain text
 * ("تكييف مركزي، واي فاي"). A strict JSON.parse on one such row used to break
 * whole pages (hotels, team & accounts), so lists are read leniently.
 */
export function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const text = String(value ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      /* fall through to plain text */
    }
  }
  return text.split(/[،,؛;\r\n]+/).map((s) => s.trim()).filter(Boolean);
}

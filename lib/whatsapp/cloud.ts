/**
 * WhatsApp Business Cloud API (Meta). Sakhr answers customers here and the
 * team replies from the dashboard inbox.
 *
 * Settings (server environment):
 *   WHATSAPP_TOKEN            permanent access token of the Meta app (System User)
 *   WHATSAPP_PHONE_NUMBER_ID  the business phone number id
 *   WHATSAPP_VERIFY_TOKEN     any secret string, also typed in Meta's webhook screen
 *   WHATSAPP_APP_SECRET       the Meta app secret (checks that webhooks come from Meta)
 */
import crypto from 'crypto';

// WHATSAPP_GRAPH_URL only for local tests against a mock server.
const GRAPH = process.env.WHATSAPP_GRAPH_URL?.trim() || 'https://graph.facebook.com/v21.0';

export type WhatsAppConfig = { token: string; phoneNumberId: string; verifyToken: string; appSecret: string };

export function whatsappConfig(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_TOKEN?.trim() || '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || '';
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() || '';
  if (!token || !phoneNumberId || !verifyToken || !appSecret) return null;
  return { token, phoneNumberId, verifyToken, appSecret };
}

/** Webhooks are signed by Meta with the app secret (X-Hub-Signature-256). */
export function validSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const given = header.slice(7);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

async function graph(path: string, cfg: WhatsAppConfig, body: unknown) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(String(data?.error?.message || `WhatsApp API ${res.status}`)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Sends a text (split into WhatsApp-sized parts). Returns the id of the last message. */
export async function sendText(to: string, text: string, cfg = whatsappConfig()): Promise<string | null> {
  if (!cfg) throw new Error('WhatsApp is not configured');
  let lastId: string | null = null;
  for (const part of splitText(text, 3800)) {
    const data = await graph(`${cfg.phoneNumberId}/messages`, cfg, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: true, body: part },
    });
    lastId = data?.messages?.[0]?.id || lastId;
  }
  return lastId;
}

/** Blue ticks + "typing…" while Sakhr prepares the answer. */
export async function markReadAndTyping(messageId: string, cfg = whatsappConfig()) {
  if (!cfg) return;
  try {
    await graph(`${cfg.phoneNumberId}/messages`, cfg, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: 'text' },
    });
  } catch {
    /* cosmetic only */
  }
}

/** Downloads a voice note / image the customer sent. */
export async function downloadMedia(mediaId: string, cfg = whatsappConfig()): Promise<{ data: Buffer; mime: string } | null> {
  if (!cfg) return null;
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${cfg.token}` }, signal: AbortSignal.timeout(10_000) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!meta?.url) return null;
  const file = await fetch(meta.url, { headers: { Authorization: `Bearer ${cfg.token}` }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!file?.ok) return null;
  return { data: Buffer.from(await file.arrayBuffer()), mime: String(meta.mime_type || file.headers.get('content-type') || '') };
}

function splitText(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** Sakhr writes Markdown for the web chat; WhatsApp has its own small format. */
export function toWhatsAppText(markdown: string, origin: string): string {
  return markdown
    .split('\n')
    .filter((line) => !/^\s*\|?\s*:?-{3,}/.test(line)) // table separator rows
    .map((line) => {
      if (/^\s*\|/.test(line)) {
        // Table row → "a · b · c"
        return line.split('|').map((c) => c.trim()).filter(Boolean).join(' · ');
      }
      return line;
    })
    .join('\n')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^#{1,6}\s*(.+)$/gm, '*$1*')
    .replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, (_m, label, path) => `${label}: ${origin}${path}`)
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1: $2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

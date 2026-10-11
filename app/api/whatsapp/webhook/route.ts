import { after, NextRequest, NextResponse } from 'next/server';
import { validSignature, whatsappConfig } from '@/lib/whatsapp/cloud';
import { handleIncoming, type IncomingMessage } from '@/lib/whatsapp/bot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * WhatsApp Business webhook (Meta → this app).
 *   GET  — one-time verification when the URL is saved in Meta's dashboard.
 *   POST — incoming messages. Answered 200 at once (Meta retries slow webhooks);
 *          Sakhr's reply is prepared right after, in the background.
 */
export async function GET(req: NextRequest) {
  const cfg = whatsappConfig();
  const p = req.nextUrl.searchParams;
  if (cfg && p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === cfg.verifyToken) {
    return new NextResponse(p.get('hub.challenge') || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const cfg = whatsappConfig();
  if (!cfg) return NextResponse.json({ ok: false }, { status: 503 });

  const raw = await req.text();
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'), cfg.appSecret)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const incoming: IncomingMessage[] = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value;
      if (value?.metadata?.phone_number_id && value.metadata.phone_number_id !== cfg.phoneNumberId) continue;
      const names = new Map<string, string>((value?.contacts || []).map((c: any) => [String(c?.wa_id), String(c?.profile?.name || '')]));
      for (const m of value?.messages || []) {
        incoming.push({
          id: String(m.id),
          from: String(m.from),
          profileName: names.get(String(m.from)) || undefined,
          type: String(m.type),
          text: m.text?.body || m.button?.text || m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '',
          audioId: m.type === 'audio' ? m.audio?.id : undefined,
        });
      }
    }
  }

  if (incoming.length) {
    const origin = process.env.APP_ORIGIN?.trim() || req.nextUrl.origin;
    after(async () => {
      for (const msg of incoming) {
        try {
          await handleIncoming(msg, origin);
        } catch (err) {
          console.error('[whatsapp] message failed', (err as Error)?.message);
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}

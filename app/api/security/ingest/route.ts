import { NextResponse } from 'next/server';
import { getPolicy, recordEvents } from '@/lib/security-monitor';
import { INGEST_HEADER, INGEST_TOKEN } from '@/lib/security-transport';
import type { SecurityEvent } from '@/lib/security-threats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Internal sink for the Edge middleware. Accepts a batch of request events and
 * answers with the firewall policy so the middleware can enforce blocks itself.
 */
export async function POST(req: Request) {
  if (req.headers.get(INGEST_HEADER) !== INGEST_TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const events = Array.isArray(body?.events) ? (body.events as SecurityEvent[]) : [];
    if (events.length) recordEvents(events);
  } catch {
    /* a malformed batch must not break policy delivery */
  }

  return NextResponse.json(getPolicy());
}

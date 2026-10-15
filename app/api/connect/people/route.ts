import { NextRequest, NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { act, lookup, peopleFor, type PeopleAction } from '@/lib/connect/people';

export const dynamic = 'force-dynamic';

const ACTIONS: PeopleAction[] = ['request', 'accept', 'decline', 'block', 'unblock', 'cancel', 'remove'];

/**
 * Clients connecting with each other.
 *   GET                 requests waiting for me, requests I sent, blocked, suggestions
 *   GET ?q=<phone|email|code>   one exact match (or null)
 *   POST {action, id}   request | accept | decline | block | unblock | cancel | remove
 */
export async function GET(req: NextRequest) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const q = req.nextUrl.searchParams.get('q');
  const body = q !== null ? { person: lookup(s.me, q) } : peopleFor(s.me);
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '') as PeopleAction;
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  const result = act(s.me, String(body.id || ''), action);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ state: result.state });
}

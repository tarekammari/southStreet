import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { verifyPurposeToken } from '@/lib/auth';
import { requireSession, STEP_UP_HEADER } from '@/lib/staff-gate';
import { dbLogAudit } from '@/lib/db';
import { findTool } from '@/lib/sakhr/tools';

/**
 * Runs a change Sakhr prepared, after the user approved its confirmation card.
 * The card token is bound to this user, expires after 10 minutes and works once.
 * The change itself goes through the normal API handler (same permission
 * checks; 428 → the browser asks for a security-key tap and retries).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const g = globalThis as unknown as { __ssSakhrUsed?: Map<string, number> };
const used = (g.__ssSakhrUsed ||= new Map());

function markUsed(key: string) {
  const now = Date.now();
  for (const [k, t] of used) if (now - t > 15 * 60 * 1000) used.delete(k);
  used.set(key, now);
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if ('error' in session) return session.error;

  const body = await req.json().catch(() => ({}));
  const token = String(body.token || '');
  const claims = verifyPurposeToken<{ sub: string; tool: string; args: Record<string, unknown> }>(token, 'sakhr-action');
  if (!claims || claims.sub !== session.account.id) {
    return NextResponse.json({ error: 'انتهت صلاحية هذا الطلب. اطلبه من صخر مرة أخرى.' }, { status: 410 });
  }

  const key = crypto.createHash('sha256').update(token).digest('hex');
  if (used.has(key)) return NextResponse.json({ error: 'تم تنفيذ هذا الطلب مسبقاً.' }, { status: 409 });

  const tool = findTool(claims.tool);
  if (!tool || tool.kind !== 'write' || !tool.run || !tool.roles.includes(session.role)) {
    return NextResponse.json({ error: 'هذا الإجراء غير متاح لصلاحياتك.' }, { status: 403 });
  }

  const result = await tool.run(
    { req, role: session.role, userId: session.account.id, stepUp: req.headers.get(STEP_UP_HEADER) || undefined },
    claims.args || {}
  );

  // Needs a security-key tap: answer 428 so the browser taps and retries (token stays usable).
  if (result.status === 428) {
    return NextResponse.json({ error: result.error, code: 'STEP_UP_REQUIRED' }, { status: 428 });
  }

  markUsed(key);
  try {
    dbLogAudit(
      session.account.name,
      session.role,
      result.ok ? 'تنفيذ إجراء عبر صخر' : 'فشل إجراء عبر صخر',
      `${tool.name}${tool.summarize ? ` — ${tool.summarize(claims.args || {})}` : ''}`
    );
  } catch {
    /* audit is best-effort */
  }

  if (!result.ok) return NextResponse.json({ error: result.error || 'تعذّر التنفيذ' }, { status: result.status && result.status >= 400 ? result.status : 400 });
  return NextResponse.json({ ok: true, tool: tool.name, data: result.data });
}

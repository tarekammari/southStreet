import { NextRequest } from 'next/server';

/**
 * Sakhr acts through the app's own API handlers, in-process, carrying the
 * signed-in user's credentials. Every permission check, validation and audit
 * entry those routes already enforce applies to the AI exactly as it applies
 * to the person clicking in the dashboard — there is no second rule set.
 */

type Handler = (req: NextRequest) => Promise<Response> | Response;

export type CallerContext = {
  /** The incoming request: its Authorization / cookie headers identify the user. */
  req: Request;
  /** Short-lived step-up token when the user just tapped their security key. */
  stepUp?: string;
};

export type RouteResult = { ok: boolean; status: number; data: any };

const FORWARDED = ['authorization', 'cookie', 'user-agent', 'accept-language', 'x-forwarded-for', 'x-real-ip'];

export async function callRoute(
  handler: Handler,
  ctx: CallerContext,
  opts: { path: string; method?: string; query?: Record<string, string | number | undefined>; body?: unknown }
): Promise<RouteResult> {
  const origin = new URL(ctx.req.url).origin;
  const url = new URL(opts.path, origin);
  for (const [k, v] of Object.entries(opts.query || {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }

  const headers = new Headers();
  for (const name of FORWARDED) {
    const value = ctx.req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (ctx.stepUp) headers.set('x-step-up', ctx.stepUp);
  if (opts.body !== undefined) headers.set('content-type', 'application/json');

  const request = new NextRequest(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  try {
    const res = await handler(request);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error('[sakhr] route call failed', opts.path, err);
    return { ok: false, status: 500, data: { error: 'تعذّر تنفيذ الطلب' } };
  }
}

'use client';

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';

/** Browser side of security-key sign-in, enrollment and step-up. */

export function securityKeysSupported(): boolean {
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
}

export async function assertWithKey(optionsJSON: any) {
  return startAuthentication({ optionsJSON });
}

export async function createKey(optionsJSON: any) {
  return startRegistration({ optionsJSON });
}

/** Turns WebAuthn browser errors into short Arabic messages. */
export function keyErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name || '';
  if (name === 'NotAllowedError' || name === 'AbortError') return 'تم إلغاء العملية أو انتهت مهلة لمس المفتاح. أعد المحاولة.';
  if (name === 'InvalidStateError') return 'هذا المفتاح مسجّل مسبقاً على هذا الحساب.';
  if (name === 'SecurityError') return 'يجب فتح الموقع عبر HTTPS أو localhost لاستعمال مفتاح الأمان.';
  if (name === 'NotSupportedError') return 'هذا المتصفح أو الجهاز لا يدعم مفاتيح الأمان.';
  const msg = (err as { message?: string })?.message || '';
  return /[\u0600-\u06FF]/.test(msg) ? msg : 'تعذّر استعمال مفتاح الأمان.';
}

function bearer(): Record<string, string> {
  try {
    const token = localStorage.getItem('south_street_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

let cachedStepUp: { token: string; until: number } | null = null;

/** Asks the user to tap their key and returns a short-lived step-up token. */
export async function getStepUpToken(): Promise<string> {
  if (cachedStepUp && cachedStepUp.until > Date.now()) return cachedStepUp.token;
  const start = await fetch('/api/auth/webauthn/step-up', { headers: bearer(), cache: 'no-store' });
  const startData = await start.json().catch(() => ({}));
  if (!start.ok) throw new Error(startData.error || 'تعذّر بدء التحقق بمفتاح الأمان');
  const response = await assertWithKey(startData.options);
  const finish = await fetch('/api/auth/webauthn/step-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer() },
    body: JSON.stringify({ flowToken: startData.flowToken, response }),
  });
  const finishData = await finish.json().catch(() => ({}));
  if (!finish.ok || !finishData.stepUpToken) throw new Error(finishData.error || 'تعذّر التحقق من مفتاح الأمان');
  // Server accepts it for 5 minutes; reuse for 4 to avoid edge expiry.
  cachedStepUp = { token: finishData.stepUpToken, until: Date.now() + 4 * 60 * 1000 };
  return finishData.stepUpToken;
}

/**
 * fetch() for admin APIs: adds the bearer token, and when the server answers
 * 428 STEP_UP_REQUIRED, asks for a key tap and retries once.
 */
export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const send = (extra: Record<string, string> = {}) =>
    fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), ...bearer(), ...extra },
    });
  const first = await send();
  if (first.status !== 428) return first;
  const token = await getStepUpToken();
  return send({ 'x-step-up': token });
}

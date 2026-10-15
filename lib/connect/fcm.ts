/**
 * Firebase Cloud Messaging (HTTP v1) for the native Android app of Connect.
 * Calls arrive as high-priority *data* messages: the app's own code shows the
 * full-screen call screen and loops the ringtone, like a phone app.
 *
 * Needs FIREBASE_SERVICE_ACCOUNT_B64 (the service-account JSON, base64). Without
 * it native push is off and everything else keeps working. No SDK: a signed JWT
 * is exchanged for an access token with Node's crypto.
 */
import crypto from 'node:crypto';

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

let account: ServiceAccount | null | undefined;
let token: { value: string; exp: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64?.trim();
    account = raw ? (JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as ServiceAccount) : null;
  } catch {
    account = null;
  }
  return account;
}

export const fcmReady = () => Boolean(serviceAccount());

const b64url = (v: Buffer | string) => Buffer.from(v).toString('base64url');

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (token && token.exp - 60_000 > Date.now()) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.private_key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${b64url(signature)}` }),
  });
  if (!res.ok) throw new Error(`fcm auth ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return token.value;
}

/** Sends a data message. Returns 'gone' when the device token is no longer valid. */
export async function sendFcm(deviceToken: string, data: Record<string, string>, ttlSeconds: number): Promise<'ok' | 'gone' | 'error'> {
  const sa = serviceAccount();
  if (!sa) return 'error';
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { token: deviceToken, data, android: { priority: 'HIGH', ttl: `${ttlSeconds}s` } },
      }),
    });
    if (res.ok) return 'ok';
    if (res.status === 404 || res.status === 400) {
      const text = await res.text();
      if (/UNREGISTERED|INVALID_ARGUMENT.*token|registration-token-not-registered/i.test(text)) return 'gone';
    }
    return 'error';
  } catch {
    return 'error';
  }
}

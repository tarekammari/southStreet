/**
 * Web Push for South Street Connect: new messages and incoming calls reach the
 * phone even when the app is closed (installed app on iPhone, iOS 16.4+).
 * Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT; without them push
 * is simply off and the app still works while open.
 */
import webpush from 'web-push';
import { dropPush, pushTargets } from './store';

let configured: boolean | null = null;

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY?.trim() || '';
}

function ready(): boolean {
  if (configured !== null) return configured;
  const pub = vapidPublicKey();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim() || '';
  configured = Boolean(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || 'mailto:contact@southstreet.dz', pub, priv);
  return configured;
}

export type PushPayload = { title: string; body: string; tag: string; url: string; kind: 'message' | 'call' };

export async function pushTo(userId: string, payload: PushPayload): Promise<void> {
  if (!ready()) return;
  const targets = pushTargets(userId);
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(t.subscription, JSON.stringify(payload), {
          TTL: payload.kind === 'call' ? 45 : 3600,
          urgency: payload.kind === 'call' ? 'high' : 'normal',
        });
      } catch (err: any) {
        // The browser removed this subscription (app uninstalled / permission revoked).
        if (err?.statusCode === 404 || err?.statusCode === 410) dropPush(t.key);
      }
    })
  );
}

/** STUN always; TURN (relay through firewalls / mobile networks) when configured. */
export function iceServers(): RTCIceServerLike[] {
  const servers: RTCIceServerLike[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const urls = (process.env.TURN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (urls.length) {
    servers.push({ urls, username: process.env.TURN_USERNAME?.trim() || '', credential: process.env.TURN_CREDENTIAL?.trim() || '' });
  }
  return servers;
}

type RTCIceServerLike = { urls: string | string[]; username?: string; credential?: string };

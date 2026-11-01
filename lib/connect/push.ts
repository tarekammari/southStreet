/**
 * Web Push for Connect: new messages and incoming calls reach the
 * phone even when the app is closed (installed app on iPhone, iOS 16.4+).
 * Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT; without them push
 * is simply off and the app still works while open.
 */
import crypto from 'node:crypto';
import webpush from 'web-push';
import { dropPush, pushTargets } from './store';
import { fcmReady, sendFcm } from './fcm';
import { getBrand } from '../brand-server';

let configured: boolean | null = null;

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY?.trim() || '';
}

function ready(): boolean {
  if (configured !== null) return configured;
  const pub = vapidPublicKey();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim() || '';
  configured = Boolean(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || `mailto:${getBrand().email}`, pub, priv);
  return configured;
}

export type PushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
  kind: 'message' | 'call' | 'call-end';
  callId?: string;
  /** Native call screen: caller details and how the call ended. */
  caller?: string;
  photo?: string;
  role?: string;
  outcome?: 'answered' | 'missed' | 'declined' | 'ended';
  /** Messages: the device shows one notification per message even when both paths deliver it. */
  msgId?: string;
  chatId?: string;
};

export const pushReady = () => ready() || fcmReady();

export async function pushTo(userId: string, payload: PushPayload): Promise<void> {
  const targets = pushTargets(userId);
  await Promise.all(
    targets.map(async (t) => {
      // Native Android app: a data message its own code turns into a call screen.
      if (t.subscription?.fcm) {
        const data: Record<string, string> = {};
        for (const [k, v] of Object.entries(payload)) if (v !== undefined && v !== null) data[k] = String(v);
        const result = await sendFcm(t.subscription.fcm, data, payload.kind === 'call' ? 45 : payload.kind === 'call-end' ? 120 : 3600);
        if (result === 'gone') dropPush(t.key);
        return;
      }
      if (!ready()) return;
      // A web notice that the call was answered elsewhere is not needed.
      if (payload.kind === 'call-end' && payload.outcome === 'answered') return;
      try {
        await webpush.sendNotification(t.subscription, JSON.stringify(payload), {
          TTL: payload.kind === 'call' ? 45 : payload.kind === 'call-end' ? 120 : 3600,
          urgency: payload.kind === 'call' ? 'high' : 'normal',
        });
      } catch (err: any) {
        // The browser removed this subscription (app uninstalled / permission revoked).
        if (err?.statusCode === 404 || err?.statusCode === 410) dropPush(t.key);
      }
    })
  );
}

/**
 * Our own relay (deploy/coturn-setup.sh) when configured: its STUN finds each
 * phone's public address and its TURN carries the call when the phones cannot
 * reach each other (carrier NAT, strict Wi-Fi) — over UDP, TCP and TLS 5349.
 * Nobody else learns who calls whom. Without it, Google's public STUN is used.
 * With TURN_SECRET (coturn "use-auth-secret") every user gets a password valid
 * for 12 hours only; TURN_USERNAME / TURN_CREDENTIAL remain for a fixed account.
 */
export function iceServers(userId = 'connect'): RTCIceServerLike[] {
  const urls = (process.env.TURN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!urls.length) return [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const hosts = [...new Set(urls.map((u) => u.match(/^turns?:([^:?]+)/)?.[1]).filter(Boolean))];
  const stun = (process.env.STUN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const servers: RTCIceServerLike[] = [{ urls: stun.length ? stun : hosts.map((h) => `stun:${h}:3478`) }];
  const secret = process.env.TURN_SECRET?.trim();
  if (secret) {
    const username = `${Math.floor(Date.now() / 1000) + 12 * 3600}:${userId}`;
    const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
    servers.push({ urls, username, credential });
  } else {
    servers.push({ urls, username: process.env.TURN_USERNAME?.trim() || '', credential: process.env.TURN_CREDENTIAL?.trim() || '' });
  }
  return servers;
}

type RTCIceServerLike = { urls: string | string[]; username?: string; credential?: string };

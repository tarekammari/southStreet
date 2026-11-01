/**
 * In-process event bus for Connect. Every write (message, call,
 * answer, network candidate, hang-up) is published here and the live
 * connection of the recipient (/api/connect/stream) forwards it at once.
 *
 * On the VPS (one Node process) this is instant. On serverless hosts the
 * recipient may be connected to another instance, so the stream also checks
 * the database about once a second as a fallback.
 */
import { EventEmitter } from 'events';

export type ConnectEvent =
  /** A new message; `from`…`preview` let the app show a banner without asking the server. */
  | { type: 'chat'; chatId: string; ts: number; msgId?: string; from?: string; name?: string; preview?: string }
  /** The other side received (`delivered`) / read (`read`) my messages up to these times. */
  | { type: 'receipt'; chatId: string; by: string; delivered: number; read: number }
  | {
      type: 'incoming';
      id: string;
      offer?: string;
      /** The caller's device key and its signature over the offer (lib/connect/e2e.ts). */
      key?: string;
      sig?: string;
      caller: { id: string; name: string; roleLabel: string; photo: string };
    }
  | { type: 'call'; id: string; state: string; answer?: string | null; key?: string | null; sig?: string | null; ringingTs?: number | null }
  /** A network candidate, or (JSON with `restart`) a reconnect after the network changed. */
  | { type: 'ice'; id: string; candidate: string; ts: number }
  /** A contact request was sent, accepted, declined or removed: reload the people lists. */
  | { type: 'people'; ts: number };

const g = globalThis as unknown as { __ssConnectBus?: EventEmitter };
const bus = (g.__ssConnectBus ||= (() => {
  const e = new EventEmitter();
  e.setMaxListeners(0);
  return e;
})());

export function publish(userId: string, event: ConnectEvent) {
  bus.emit(`u:${userId}`, event);
}

/** Someone has a live connection open (the open app, or the Android app's background listener). */
export function listening(userId: string): boolean {
  return bus.listenerCount(`u:${userId}`) > 0;
}

export function subscribe(userId: string, fn: (event: ConnectEvent) => void): () => void {
  const key = `u:${userId}`;
  bus.on(key, fn);
  return () => bus.off(key, fn);
}

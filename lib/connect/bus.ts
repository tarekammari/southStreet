/**
 * In-process event bus for South Street Connect. Every write (message, call,
 * answer, network candidate, hang-up) is published here and the live
 * connection of the recipient (/api/connect/stream) forwards it at once.
 *
 * On the VPS (one Node process) this is instant. On serverless hosts the
 * recipient may be connected to another instance, so the stream also checks
 * the database about once a second as a fallback.
 */
import { EventEmitter } from 'events';

export type ConnectEvent =
  | { type: 'chat'; chatId: string; ts: number }
  | { type: 'incoming'; id: string; offer?: string; caller: { id: string; name: string; roleLabel: string; photo: string } }
  | { type: 'call'; id: string; state: string; answer?: string | null }
  | { type: 'ice'; id: string; candidate: string; ts: number };

const g = globalThis as unknown as { __ssConnectBus?: EventEmitter };
const bus = (g.__ssConnectBus ||= (() => {
  const e = new EventEmitter();
  e.setMaxListeners(0);
  return e;
})());

export function publish(userId: string, event: ConnectEvent) {
  bus.emit(`u:${userId}`, event);
}

export function subscribe(userId: string, fn: (event: ConnectEvent) => void): () => void {
  const key = `u:${userId}`;
  bus.on(key, fn);
  return () => bus.off(key, fn);
}

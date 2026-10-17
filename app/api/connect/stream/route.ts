import { connectSession } from '@/lib/connect/session';
import { subscribe, type ConnectEvent } from '@/lib/connect/bus';
import { incomingEvent, incomingFor, latestActivity, markDelivered, touchPresence, userById } from '@/lib/connect/store';
import { linksStamp } from '@/lib/connect/links';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Live connection of the Connect app (Server-Sent Events). The server pushes
 * new messages, incoming calls and call setup the moment they happen. The
 * browser reconnects by itself when the connection ends (about every minute).
 */
export async function GET(req: Request) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const me = s.me;
  const encoder = new TextEncoder();
  const LIFETIME = 50_000;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          stop();
        }
      };
      // Tell the browser to reconnect quickly after the stream ends.
      controller.enqueue(encoder.encode('retry: 800\n\n'));
      // `version`: the deployed build, so an open app knows when to update itself.
      send('hello', { now: Date.now(), version: process.env.APP_VERSION || '' });

      const unsubscribe = subscribe(me.id, (e: ConnectEvent) => send(e.type, e));
      // Online from the first second, and everything sent while away is now delivered.
      touchPresence(me.id);
      markDelivered(me.id);

      // Fallback for other server instances: look at the database about once a second.
      let lastActivity = latestActivity(me.id);
      let lastIncoming = '';
      let lastPeople = linksStamp(me.id);
      const check = () => {
        try {
          const act = latestActivity(me.id);
          if (act > lastActivity) {
            lastActivity = act;
            markDelivered(me.id, act);
            send('chat', { type: 'chat', chatId: '', ts: act });
          }
          const people = linksStamp(me.id);
          if (people !== lastPeople) {
            lastPeople = people;
            send('people', { type: 'people', ts: people });
          }
          const call = incomingFor(me.id);
          if (call && call.id !== lastIncoming) {
            lastIncoming = call.id;
            const caller = userById(call.callerId);
            if (caller) send('incoming', incomingEvent(call, caller));
          }
        } catch {
          /* next round */
        }
      };
      const poll = setInterval(check, 1000);
      const heartbeat = setInterval(() => {
        try {
          touchPresence(me.id);
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          stop();
        }
      }, 15_000);
      const end = setTimeout(() => stop(), LIFETIME);

      function stop() {
        if (closed) return;
        closed = true;
        clearInterval(poll);
        clearInterval(heartbeat);
        clearTimeout(end);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
      req.signal.addEventListener('abort', stop);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      // Nginx: do not buffer, deliver each event immediately.
      'X-Accel-Buffering': 'no',
    },
  });
}

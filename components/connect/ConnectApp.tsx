'use client';

/**
 * South Street Connect — the installable messenger (Android, iPhone, Windows).
 * Chats, voice notes and voice calls between clients and the agency team.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Bell, BellOff, Download, Loader2, MessageCircle, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Search, Users } from 'lucide-react';
import { authHeaders, jsonAuthHeaders } from '@/lib/api-client';
import { VoiceCall, startTone, stopTone, type CallEndReason, type CallPhase } from '@/lib/connect/rtc';
import type { ConnectContact, ConnectUser } from '@/lib/connect/store';
import ChatView from './ChatView';
import CallOverlay, { type CallView } from './CallOverlay';
import './connect.css';

const LoginModal = dynamic(() => import('@/components/LoginModal'), { ssr: false });

type Tab = 'chats' | 'contacts' | 'calls';
type CallLog = { id: string; peerId: string; peerName: string; outgoing: boolean; state: string; createdTs: number; seconds: number };
type Incoming = { id: string; offer: string; caller: { id: string; name: string; roleLabel: string; photo: string } };

const END_NOTE: Record<CallEndReason, string> = {
  hangup: 'انتهت المكالمة',
  'remote-ended': 'أنهى الطرف الآخر المكالمة',
  declined: 'رُفضت المكالمة',
  missed: 'لم يتم الرد',
  busy: 'الطرف الآخر في مكالمة أخرى',
  failed: 'تعذّر الاتصال — تحقق من الشبكة',
};

function shortTime(ts: number) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' });
}

/** Remove the ringing notification of a call once it is answered / declined in the app. */
function clearCallNotifications(callId: string | null) {
  if (!callId || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.getRegistration('/connect').then((reg) =>
    reg?.getNotifications({ tag: `call-${callId}` }).then((list) => list.forEach((n) => n.close()))
  ).catch(() => undefined);
}

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function ConnectApp() {
  const [me, setMe] = useState<ConnectUser | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [vapid, setVapid] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ConnectContact[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [tab, setTab] = useState<Tab>('chats');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [callView, setCallView] = useState<CallView | null>(null);
  const [pushState, setPushState] = useState<'unknown' | 'on' | 'off' | 'unsupported'>('unknown');
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [standalone, setStandalone] = useState(true);
  const callRef = useRef<VoiceCall | null>(null);
  const incomingRef = useRef<Incoming | null>(null);
  const stamps = useRef<Record<string, number>>({});
  const autoAnswer = useRef<string | null>(null);
  const acceptRef = useRef<() => Promise<void>>(async () => undefined);

  /* ---------- start ---------- */
  useEffect(() => {
    void fetch('/api/connect/config', { headers: authHeaders(), cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) return setNeedLogin(true);
        const data = await r.json();
        setMe(data.me);
        setIceServers(data.iceServers || []);
        setVapid(data.vapidPublicKey || null);
      })
      .catch(() => setNeedLogin(true));
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/connect-sw.js', { scope: '/connect' }).catch(() => undefined);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return setPushState('unsupported');
    setPushState(Notification.permission === 'granted' ? 'on' : 'off');
  }, []);

  const loadContacts = useCallback(async () => {
    const res = await fetch('/api/connect/contacts', { headers: authHeaders(), cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setContacts(data.contacts || []);
    setCalls(data.calls || []);
  }, []);

  useEffect(() => {
    if (!me) return;
    void loadContacts();
    const params = new URLSearchParams(window.location.search);
    const chat = params.get('chat');
    if (chat) setOpenId(chat);
  }, [me, loadContacts]);

  /* ---------- calls ---------- */
  const endUi = useCallback((reason: CallEndReason) => {
    stopTone();
    clearCallNotifications(incomingRef.current?.id || callRef.current?.id || null);
    setCallView((v) => (v ? { ...v, phase: 'ended', note: END_NOTE[reason] } : v));
    callRef.current = null;
    incomingRef.current = null;
    window.setTimeout(() => setCallView((v) => (v?.phase === 'ended' ? null : v)), 1800);
    void loadContacts();
    setRefreshKey((k) => k + 1);
  }, [loadContacts]);

  const handlers = useMemo(
    () => ({
      onPhase: (phase: CallPhase) => {
        if (phase === 'active' || phase === 'connecting') stopTone();
        if (phase !== 'ended') setCallView((v) => (v ? { ...v, phase } : v));
      },
      onEnd: endUi,
      onConnectedAt: (ts: number) => setCallView((v) => (v ? { ...v, connectedAt: ts } : v)),
    }),
    [endUi]
  );

  const placeCall = async (peer: ConnectContact) => {
    if (callRef.current) return;
    setCallView({ peerName: peer.name, peerPhoto: peer.photo, peerRole: peer.roleLabel, phase: 'calling', muted: false });
    const call = new VoiceCall(iceServers, handlers);
    callRef.current = call;
    try {
      await call.call(peer.id);
      setCallView((v) => (v ? { ...v, phase: 'ringing' } : v));
      startTone('ringback');
    } catch (err) {
      if (callRef.current === call) endUi((err as { code?: string }).code === 'BUSY' ? 'busy' : 'failed');
    }
  };

  const acceptCall = async () => {
    const inc = incomingRef.current;
    if (!inc) return;
    stopTone();
    clearCallNotifications(inc.id);
    const call = new VoiceCall(iceServers, handlers);
    callRef.current = call;
    setCallView((v) => (v ? { ...v, phase: 'connecting' } : v));
    try {
      await call.answer(inc.id, inc.offer);
    } catch {
      endUi('failed');
    }
  };

  acceptRef.current = acceptCall;

  const declineCall = async () => {
    const inc = incomingRef.current;
    stopTone();
    if (inc) await VoiceCall.decline(inc.id);
    endUi('declined');
  };

  /* ---------- live connection ---------- */
  const showIncoming = useCallback((inc: Incoming) => {
    if (callRef.current || incomingRef.current) return;
    incomingRef.current = inc;
    setCallView({ peerName: inc.caller.name, peerPhoto: inc.caller.photo, peerRole: inc.caller.roleLabel, phase: 'incoming', muted: false });
    // Opened from the notification's "رد" button: answer straight away.
    if (autoAnswer.current && autoAnswer.current === inc.id) {
      autoAnswer.current = null;
      void acceptRef.current();
    } else {
      startTone('ring');
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    let es: EventSource | null = null;
    let fallback = 0;
    let failures = 0;

    // Backup when the live stream is not available: ask every few seconds.
    const pollOnce = async () => {
      try {
        const res = await fetch('/api/connect/poll', { headers: authHeaders(), cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const changed = Object.entries(data.stamps || {}).some(([chat, ts]) => stamps.current[chat] !== ts);
        stamps.current = data.stamps || {};
        if (changed) {
          void loadContacts();
          setRefreshKey((k) => k + 1);
        }
        if (data.incoming) showIncoming(data.incoming);
        else if (incomingRef.current && !callRef.current) endUi('missed');
      } catch {
        /* offline for a moment */
      }
    };
    const startFallback = () => {
      if (fallback) return;
      fallback = window.setInterval(() => document.visibilityState === 'visible' && void pollOnce(), 3000);
    };
    const stopFallback = () => {
      window.clearInterval(fallback);
      fallback = 0;
    };

    const open = () => {
      if (!alive || typeof EventSource === 'undefined') return startFallback();
      es = new EventSource('/api/connect/stream');
      es.addEventListener('hello', () => {
        failures = 0;
        stopFallback();
        void pollOnce(); // catch up on anything missed while disconnected
      });
      es.addEventListener('chat', () => {
        void loadContacts();
        setRefreshKey((k) => k + 1);
      });
      es.addEventListener('incoming', (ev) => {
        try {
          showIncoming(JSON.parse((ev as MessageEvent).data));
        } catch {
          /* ignore */
        }
      });
      const toCall = (ev: Event) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          if (callRef.current) void callRef.current.signal(data);
          else if (data.type === 'call' && incomingRef.current?.id === data.id && data.state !== 'ringing') endUi('missed');
        } catch {
          /* ignore */
        }
      };
      es.addEventListener('call', toCall);
      es.addEventListener('ice', toCall);
      es.onerror = () => {
        failures += 1;
        // The browser reconnects by itself; after repeated failures use the backup.
        if (failures >= 3) startFallback();
      };
    };
    open();

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!es || es.readyState === EventSource.CLOSED) {
        es?.close();
        open();
      }
      void pollOnce();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      es?.close();
      stopFallback();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [me, loadContacts, endUi, showIncoming]);

  // Notification buttons: "رد" opens the app and answers; the worker may also message an open window.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('answer') === '1' && params.get('call')) autoAnswer.current = params.get('call');
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'open') return;
      if (e.data.answer && e.data.callId) {
        if (incomingRef.current?.id === e.data.callId) void acceptRef.current();
        else autoAnswer.current = e.data.callId;
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, []);

  /* ---------- push ---------- */
  const enablePush = async () => {
    try {
      if (!vapid) throw new Error('no key');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setPushState('off');
      const reg = await navigator.serviceWorker.register('/connect-sw.js', { scope: '/connect' });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) }));
      await fetch('/api/connect/push', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify({ subscription: sub.toJSON() }) });
      setPushState('on');
    } catch {
      setPushState('off');
    }
  };

  /* ---------- view ---------- */
  const open = contacts.find((c) => c.id === openId) || null;
  const totalUnread = contacts.reduce((n, c) => n + c.unread, 0);
  const q = query.trim().toLowerCase();
  const filtered = contacts.filter((c) => !q || c.name.toLowerCase().includes(q) || c.roleLabel.includes(q));
  const chats = filtered.filter((c) => c.lastTs);
  const team = filtered.filter((c) => c.role !== 'PILGRIM_USER');
  const clients = filtered.filter((c) => c.role === 'PILGRIM_USER');

  if (needLogin) {
    return (
      <div className="cn-app cn-login" dir="rtl">
        <div className="cn-login-card">
          <img src="/icons/connect-192.png" alt="" />
          <h1>South Street Connect</h1>
          <p>رسائل ومكالمات صوتية بين المعتمرين وفريق الوكالة. سجّل الدخول بحسابك في ساوث ستريت.</p>
          {!standalone && installEvt ? (
            <button type="button" className="cn-pill" style={{ margin: '12px auto 0' }} onClick={async () => { installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); }}>
              <Download className="w-4 h-4" /> تثبيت التطبيق
            </button>
          ) : null}
        </div>
        <LoginModal onClose={() => undefined} redirectTo="/connect" />
      </div>
    );
  }

  if (!me) {
    return <div className="cn-app cn-center" dir="rtl"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const row = (c: ConnectContact, showLast: boolean) => (
    <li key={c.id}>
      <button type="button" className="cn-row" onClick={() => setOpenId(c.id)}>
        <span className="cn-avatar">{c.photo ? <img src={c.photo} alt="" /> : c.name.charAt(0)}{c.online ? <i className="cn-dot" /> : null}</span>
        <span className="cn-row-main">
          <span className="cn-row-top"><b>{c.name}</b>{showLast ? <small>{shortTime(c.lastTs)}</small> : null}</span>
          <span className="cn-row-sub">
            <small>{showLast ? c.lastText || c.roleLabel : c.roleLabel}</small>
            {c.unread ? <em className="cn-badge">{c.unread}</em> : null}
          </span>
        </span>
      </button>
      {!showLast ? (
        <button type="button" className="cn-icon is-call" onClick={() => void placeCall(c)} aria-label={`اتصال بـ ${c.name}`}><Phone className="w-5 h-5" /></button>
      ) : null}
    </li>
  );

  return (
    <div className={`cn-app${open ? ' has-chat' : ''}`} dir="rtl">
      <aside className="cn-side">
        <header className="cn-top">
          <div>
            <h1>Connect</h1>
            <small>{me.name}</small>
          </div>
          <div className="cn-top-actions">
            {!standalone && installEvt ? (
              <button type="button" className="cn-pill" onClick={async () => { installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); }}>
                <Download className="w-4 h-4" /> تثبيت
              </button>
            ) : null}
            {pushState !== 'unsupported' && vapid ? (
              <button type="button" className={`cn-icon${pushState === 'on' ? ' is-on' : ''}`} onClick={() => void enablePush()} title={pushState === 'on' ? 'الإشعارات مفعّلة' : 'تفعيل الإشعارات للرسائل والمكالمات'} aria-label="الإشعارات">
                {pushState === 'on' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </button>
            ) : null}
          </div>
        </header>

        {pushState === 'off' && vapid ? (
          <button type="button" className="cn-banner" onClick={() => void enablePush()}>
            <Bell className="w-4 h-4" /> فعّل الإشعارات لتصلك الرسائل والمكالمات والتطبيق مغلق
          </button>
        ) : null}

        <label className="cn-search">
          <Search className="w-4 h-4" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث" />
        </label>

        <div className="cn-list">
          {tab === 'chats' ? (
            chats.length ? <ul>{chats.map((c) => row(c, true))}</ul> : (
              <div className="cn-empty">
                <MessageCircle className="w-8 h-8" />
                <p>لا محادثات بعد. ابدأ من «جهات الاتصال».</p>
              </div>
            )
          ) : null}
          {tab === 'contacts' ? (
            <>
              {team.length ? (<><h3 className="cn-group">فريق الوكالة</h3><ul>{team.map((c) => row(c, false))}</ul></>) : null}
              {clients.length ? (<><h3 className="cn-group">المعتمرون</h3><ul>{clients.map((c) => row(c, false))}</ul></>) : null}
              {!team.length && !clients.length ? <div className="cn-empty"><Users className="w-8 h-8" /><p>لا توجد جهات اتصال.</p></div> : null}
            </>
          ) : null}
          {tab === 'calls' ? (
            calls.length ? (
              <ul>
                {calls.map((c) => {
                  const peer = contacts.find((p) => p.id === c.peerId);
                  const missed = c.state === 'missed' || c.state === 'declined';
                  return (
                    <li key={c.id}>
                      <div className="cn-row is-static">
                        <span className={`cn-call-icon${missed ? ' is-missed' : ''}`}>
                          {missed ? <PhoneMissed className="w-4 h-4" /> : c.outgoing ? <PhoneOutgoing className="w-4 h-4" /> : <PhoneIncoming className="w-4 h-4" />}
                        </span>
                        <span className="cn-row-main">
                          <span className="cn-row-top"><b>{c.peerName}</b><small>{shortTime(c.createdTs)}</small></span>
                          <span className="cn-row-sub"><small>{missed ? (c.outgoing ? 'لم يُرد' : 'فائتة') : c.seconds ? `${Math.floor(c.seconds / 60)}:${String(c.seconds % 60).padStart(2, '0')}` : 'ملغاة'}</small></span>
                        </span>
                      </div>
                      {peer ? <button type="button" className="cn-icon is-call" onClick={() => void placeCall(peer)} aria-label="معاودة الاتصال"><Phone className="w-5 h-5" /></button> : null}
                    </li>
                  );
                })}
              </ul>
            ) : <div className="cn-empty"><Phone className="w-8 h-8" /><p>لا مكالمات بعد.</p></div>
          ) : null}
        </div>

        <nav className="cn-tabs">
          <button type="button" className={tab === 'chats' ? 'is-on' : ''} onClick={() => setTab('chats')}>
            <MessageCircle className="w-5 h-5" /> المحادثات{totalUnread ? <em className="cn-badge">{totalUnread}</em> : null}
          </button>
          <button type="button" className={tab === 'contacts' ? 'is-on' : ''} onClick={() => setTab('contacts')}><Users className="w-5 h-5" /> جهات الاتصال</button>
          <button type="button" className={tab === 'calls' ? 'is-on' : ''} onClick={() => setTab('calls')}><Phone className="w-5 h-5" /> المكالمات</button>
        </nav>
      </aside>

      <main className="cn-main">
        {open ? (
          <ChatView
            me={me}
            peer={open}
            onBack={() => setOpenId(null)}
            onCall={() => void placeCall(open)}
            refreshKey={refreshKey}
            onChanged={() => void loadContacts()}
          />
        ) : (
          <div className="cn-welcome">
            <img src="/icons/connect-192.png" alt="" />
            <h2>South Street Connect</h2>
            <p>اختر محادثة أو جهة اتصال. الرسائل والمكالمات الصوتية بين المعتمرين وفريق الوكالة.</p>
          </div>
        )}
      </main>

      {callView ? (
        <CallOverlay
          view={callView}
          onAccept={() => void acceptCall()}
          onDecline={() => void declineCall()}
          onHangup={() => void (callRef.current ? callRef.current.hangup('hangup') : declineCall())}
          onMute={() => setCallView((v) => {
            if (!v) return v;
            callRef.current?.setMuted(!v.muted);
            return { ...v, muted: !v.muted };
          })}
        />
      ) : null}
    </div>
  );
}

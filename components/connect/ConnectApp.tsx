'use client';

/**
 * South Street Connect — the installable messenger (Android, iPhone, Windows).
 * Chats, voice notes and voice calls between clients and the agency team, and
 * between clients who accepted each other (requests, favourites, suggestions).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Bell, BellOff, Download, Info, Loader2, RefreshCw, MessageCircle, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Search, Star, UserPlus, Users } from 'lucide-react';
import { authHeaders, jsonAuthHeaders } from '@/lib/api-client';
import { VoiceCall, playMessageSound, startTone, stopTone, warmRingtone, type CallEndReason, type CallPhase } from '@/lib/connect/rtc';
import { tellAndroid } from '@/lib/connect/device-prefs';
import type { ConnectContact, ConnectUser } from '@/lib/connect/store';
import ChatView from './ChatView';
import AboutSheet from './AboutSheet';
import AndroidSetup from './AndroidSetup';
import NotifyGate from './NotifyGate';
import { AddPersonSheet, Directory, EMPTY_PEOPLE, PersonMenu, RequestList, SentAndBlocked, Suggestions, peopleAction, type PeopleData } from './People';
import type { PeopleAction } from '@/lib/connect/people';
import { androidChecks, androidInBackground, canSwitchSpeaker, downloadNewApp, nativeNeedsManualUpdate, nativePlatform, onAndroidToken, onNativeCallAction, openAndroidSettings, sendCallState } from '@/lib/connect/native-bridge';
import { versionLabel } from '@/lib/connect/version';
import CallOverlay, { CallMini, type CallView } from './CallOverlay';
import { usePipWindow } from './usePipWindow';
import './connect.css';

const LoginModal = dynamic(() => import('@/components/LoginModal'), { ssr: false });

type Tab = 'chats' | 'contacts' | 'calls';
type CallLog = { id: string; peerId: string; peerName: string; outgoing: boolean; state: string; createdTs: number; seconds: number };
/** `key` / `sig`: the caller's device key and signature (end-to-end check). */
type Incoming = { id: string; offer: string; key?: string; sig?: string; caller: { id: string; name: string; roleLabel: string; photo: string } };
/** A new message in a chat that is not on screen. */
type Banner = { from: string; name: string; preview: string; key: number };

const END_NOTE: Record<CallEndReason, string> = {
  hangup: 'انتهت المكالمة',
  'remote-ended': 'أنهى الطرف الآخر المكالمة',
  declined: 'رُفضت المكالمة',
  missed: 'لم يتم الرد',
  unreachable: 'تعذّر الوصول — هاتفه مغلق أو بلا إنترنت',
  busy: 'الطرف الآخر في مكالمة أخرى',
  failed: 'تعذّر الاتصال — تحقق من الشبكة',
  elsewhere: 'تم الرد من جهاز آخر',
  insecure: 'أُوقفت المكالمة: تعذّر التحقق من تشفيرها',
  rate: 'محاولات اتصال كثيرة — انتظر دقيقة',
};

/** No device of the other person confirmed ringing after this long: say so (the call keeps trying). */
const UNREACHABLE_HINT_MS = 12_000;

function shortTime(ts: number) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' });
}

/**
 * The app is open but minimised / in another tab: raise the same phone-style call
 * notification the server push would (رد / رفض), mark the app icon and blink the
 * window title until the call is picked up.
 */
function ringWhileHidden(inc: { id: string; caller: { name: string } }) {
  void navigator.serviceWorker?.getRegistration('/connect').then((reg) =>
    reg?.showNotification(`📞 ${inc.caller.name}`, {
      body: 'مكالمة صوتية واردة — South Street Connect',
      tag: `call-${inc.id}`,
      requireInteraction: true,
      icon: '/icons/connect-192.png',
      badge: '/icons/connect-192.png',
      dir: 'rtl',
      lang: 'ar',
      data: { url: `/connect?call=${inc.id}`, callId: inc.id },
      // Not in the TS lib yet, but supported by Chrome / Edge / Android.
      ...({ renotify: true, vibrate: [700, 300, 700, 300, 700], actions: [{ action: 'answer', title: 'رد' }, { action: 'decline', title: 'رفض' }] } as object),
    })
  ).catch(() => undefined);
  void (navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void> }).setAppBadge?.(1).catch(() => undefined);
  const title = document.title;
  let on = false;
  const blink = window.setInterval(() => {
    on = !on;
    document.title = on ? `📞 ${inc.caller.name} يتصل…` : title;
  }, 900);
  const stop = () => {
    if (document.visibilityState !== 'visible') return;
    window.clearInterval(blink);
    document.title = title;
    void (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => undefined);
    document.removeEventListener('visibilitychange', stop);
  };
  document.addEventListener('visibilitychange', stop);
  window.setTimeout(() => { window.clearInterval(blink); document.title = title; }, 60_000);
}

/** Remove the ringing notification of a call once it is answered / declined in the app. */
function clearCallNotifications(callId: string | null) {
  if (!callId || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.getRegistration('/connect').then((reg) =>
    reg?.getNotifications({ tag: `call-${callId}` }).then((list) => list.forEach((n) => n.close()))
  ).catch(() => undefined);
}

/** The build this screen runs (set in next.config.js); the live stream reports the deployed one. */
const APP_VERSION = process.env.APP_VERSION || '';

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
  const [people, setPeople] = useState<PeopleData>(EMPTY_PEOPLE);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [banner, setBanner] = useState<Banner | null>(null);
  const [found, setFound] = useState<PeopleData['everyone'] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  // Apps before 1.6.0 cannot update themselves: offer the new installer.
  const [oldApp, setOldApp] = useState(false);
  useEffect(() => setOldApp(nativeNeedsManualUpdate()), []);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [tab, setTab] = useState<Tab>('chats');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [callView, setCallView] = useState<CallView | null>(null);
  const [pushState, setPushState] = useState<'unknown' | 'on' | 'off' | 'denied' | 'unsupported'>('unknown');
  const [pushFailed, setPushFailed] = useState(false);
  const [gateLater, setGateLater] = useState(false);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [standalone, setStandalone] = useState(true);
  const [updateReady, setUpdateReady] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const pip = usePipWindow();
  const { close: closePip, open: openPip, supported: pipSupported } = pip;
  const callRef = useRef<VoiceCall | null>(null);
  const incomingRef = useRef<Incoming | null>(null);
  const stamps = useRef<Record<string, number>>({});
  const peopleStamp = useRef(0);
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
    // The chosen ringtone: ready to ring at once, and known to the Android app.
    warmRingtone();
    tellAndroid();
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // Session ended (expired after 24 h, signed out elsewhere, password changed):
  // any Connect request answered 401 brings up the sign-in window at once,
  // instead of leaving "يلزم تسجيل الدخول" errors on a screen with no way to sign in.
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      if (res.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0]);
        if (url.includes('/api/connect/') && !url.includes('/api/connect/download')) {
          setMe(null);
          setNeedLogin(true);
        }
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  useEffect(() => {
    // Inside the Windows / Android apps the shell rings, not web push.
    if (nativePlatform()) return setPushState('unsupported');
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return setPushState('unsupported');
    setPushState(Notification.permission === 'granted' ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off');
  }, []);

  const loadContacts = useCallback(async () => {
    const res = await fetch('/api/connect/contacts', { headers: authHeaders(), cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setContacts(data.contacts || []);
    setCalls(data.calls || []);
  }, []);

  // Requests, sent requests and suggestions (clients only; the team sees everyone).
  const isClient = me?.role === 'PILGRIM_USER';
  const loadPeople = useCallback(async () => {
    if (!isClient) return;
    const res = await fetch('/api/connect/people', { headers: authHeaders(), cache: 'no-store' });
    if (res.ok) setPeople({ ...EMPTY_PEOPLE, ...(await res.json()) });
  }, [isClient]);

  const onPeopleAction = useCallback(
    async (id: string, action: PeopleAction) => {
      const r = await peopleAction(id, action);
      if (r.error) setToast(r.error);
      else if (action === 'accept') setToast('تمت الإضافة إلى المفضّلين — يمكنكما المراسلة والاتصال الآن');
      else if (action === 'request' && r.state === 'friend') setToast('أصبحتما على تواصل');
      else if (action === 'request') setToast('تم إرسال الطلب');
      if (action === 'remove' || action === 'block') setOpenId((o) => (o === id ? null : o));
      await Promise.all([loadPeople(), loadContacts()]);
    },
    [loadPeople, loadContacts]
  );

  // Search box (clients): also look through every client by name.
  useEffect(() => {
    const text = query.trim();
    if (!isClient || text.length < 2) return setFound(null);
    const t = window.setTimeout(async () => {
      const res = await fetch(`/api/connect/people?search=${encodeURIComponent(text)}`, { headers: authHeaders(), cache: 'no-store' }).catch(() => null);
      if (res?.ok) setFound((await res.json()).results || []);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query, isClient]);

  /** Header button: reload chats, contacts, requests and calls now. */
  const refreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const started = Date.now();
    await Promise.all([loadContacts(), loadPeople()]).catch(() => undefined);
    setRefreshKey((k) => k + 1);
    // Keep the spin visible a moment so the tap feels answered.
    window.setTimeout(() => setRefreshing(false), Math.max(0, 500 - (Date.now() - started)));
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!me) return;
    void loadContacts();
    void loadPeople();
    const params = new URLSearchParams(window.location.search);
    const chat = params.get('chat');
    if (chat) setOpenId(chat);
    if (params.get('tab') === 'contacts') setTab('contacts');
  }, [me, loadContacts, loadPeople]);

  /* ---------- calls ---------- */
  const endUi = useCallback((reason: CallEndReason) => {
    stopTone();
    clearCallNotifications(incomingRef.current?.id || callRef.current?.id || null);
    setCallView((v) => (v ? { ...v, phase: 'ended', note: END_NOTE[reason] } : v));
    callRef.current = null;
    incomingRef.current = null;
    window.setTimeout(() => setCallView((v) => (v?.phase === 'ended' ? null : v)), 900);
    void loadContacts();
    setRefreshKey((k) => k + 1);
  }, [loadContacts]);

  const handlers = useMemo(
    () => ({
      onPhase: (phase: CallPhase) => {
        if (phase === 'active' || phase === 'connecting') stopTone();
        // The other phone really rings: now the caller hears the ringback.
        if (phase === 'ringing') startTone('ringback');
        if (phase !== 'ended') setCallView((v) => (v ? { ...v, phase, note: undefined } : v));
      },
      onEnd: endUi,
      onConnectedAt: (ts: number) => setCallView((v) => (v ? { ...v, connectedAt: ts } : v)),
      onQuality: (quality: CallView['quality']) => setCallView((v) => (v && v.quality?.level !== quality?.level ? { ...v, quality } : v)),
      onSecurity: (security: CallView['security']) => setCallView((v) => (v ? { ...v, security } : v)),
    }),
    [endUi]
  );

  const placeCall = async (peer: ConnectContact) => {
    if (callRef.current || !me) return;
    setCallView({ peerName: peer.name, peerPhoto: peer.photo, peerRole: peer.roleLabel, phase: 'calling', muted: false });
    const call = new VoiceCall(iceServers, handlers, me.id);
    callRef.current = call;
    // Still no device of theirs rings: tell the caller why it is taking long.
    window.setTimeout(() => {
      setCallView((v) => (v && callRef.current === call && v.phase === 'calling' ? { ...v, note: 'لم يصل الاتصال إلى هاتفه بعد — قد يكون مغلقًا أو بلا إنترنت' } : v));
    }, UNREACHABLE_HINT_MS);
    try {
      await call.call(peer.id);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (callRef.current === call) endUi(code === 'BUSY' ? 'busy' : code === 'RATE' ? 'rate' : 'failed');
    }
  };

  const acceptCall = async () => {
    const inc = incomingRef.current;
    if (!inc || !me) return;
    stopTone();
    clearCallNotifications(inc.id);
    const call = new VoiceCall(iceServers, handlers, me.id);
    callRef.current = call;
    setCallView((v) => (v ? { ...v, phase: 'connecting' } : v));
    try {
      await call.answer(inc.id, inc.offer, inc.caller.id, inc.key, inc.sig);
    } catch {
      endUi('failed');
    }
  };

  acceptRef.current = acceptCall;

  const declineCall = () => {
    const inc = incomingRef.current;
    stopTone();
    if (inc) VoiceCall.decline(inc.id);
    endUi('declined');
  };

  const hangupCall = () => (callRef.current ? callRef.current.hangup('hangup') : declineCall());

  const toggleMute = () =>
    setCallView((v) => {
      if (!v) return v;
      callRef.current?.setMuted(!v.muted);
      return { ...v, muted: !v.muted };
    });

  // Earpiece ↔ loudspeaker (the Android app moves the sound; each call starts on the earpiece).
  const toggleSpeaker = () => setCallView((v) => (v ? { ...v, speaker: !v.speaker } : v));

  const popOutCall = async () => {
    if (await pip.open()) setMinimized(true);
  };

  const expandCall = () => {
    pip.close();
    setMinimized(false);
    window.focus();
  };

  // Call over: close the floating window and reset the minimised state.
  useEffect(() => {
    if (callView) return;
    closePip();
    setMinimized(false);
  }, [callView, closePip]);

  // Chrome / Edge open the floating window by themselves when the user switches
  // away from the app during a call (automatic Picture-in-Picture).
  const inCall = callView?.phase === 'active' || callView?.phase === 'connecting';
  useEffect(() => {
    if (!inCall || !pipSupported || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession as unknown as { setActionHandler(action: string, handler: (() => void) | null): void };
    try {
      ms.setActionHandler('enterpictureinpicture', () => void openPip().then((w) => w && setMinimized(true)));
    } catch {
      return; // not supported by this browser version
    }
    return () => {
      try {
        ms.setActionHandler('enterpictureinpicture', null);
      } catch {
        /* ignore */
      }
    };
  }, [inCall, pipSupported, openPip]);

  /* ---------- live connection ---------- */
  const showIncoming = useCallback((inc: Incoming) => {
    if (callRef.current || incomingRef.current) return;
    incomingRef.current = inc;
    setMinimized(false);
    setCallView({ peerName: inc.caller.name, peerPhoto: inc.caller.photo, peerRole: inc.caller.roleLabel, phase: 'incoming', muted: false });
    // Tell the caller this device rings («يرنّ…»).
    VoiceCall.ringing(inc.id);
    // Opened from the notification's "رد" button: answer straight away.
    if (autoAnswer.current && autoAnswer.current === inc.id) {
      autoAnswer.current = null;
      void acceptRef.current();
    } else if (nativePlatform() !== 'windows' && !androidInBackground()) {
      // On Windows the floating call card rings (and stays above every window).
      startTone('ring');
      if (!nativePlatform() && document.visibilityState !== 'visible') ringWhileHidden(inc);
    }
  }, []);

  /* ---------- new messages: banner, sound, badge ---------- */
  // A message in a chat that is not on screen: a banner at the top (tap to open), a short
  // sound and a buzz — quietly, during a call. The chat on screen stays silent.
  const announce = useRef<(m: Omit<Banner, 'key'>) => void>(() => undefined);
  announce.current = (m) => {
    const visible = document.visibilityState === 'visible';
    if (visible && openId === m.from) return;
    if (!visible && !nativePlatform()) return; // the system notification (push) shows it
    setBanner({ ...m, key: Date.now() });
    if (!callRef.current && !incomingRef.current) {
      playMessageSound();
      navigator.vibrate?.(80);
    }
  };

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 4500);
    return () => window.clearTimeout(t);
  }, [banner]);

  /* ---------- native apps (Windows / Android) ---------- */
  // Every call change goes to the app shell: floating card, ongoing-call service…
  useEffect(() => {
    if (!nativePlatform()) return;
    sendCallState(
      callView
        ? {
            phase: callView.phase,
            id: incomingRef.current?.id || callRef.current?.id || undefined,
            name: callView.peerName,
            photo: callView.peerPhoto,
            role: callView.peerRole,
            connectedAt: callView.connectedAt,
            muted: callView.muted,
            speaker: Boolean(callView.speaker),
          }
        : null
    );
  }, [callView]);

  const nativeActions = useRef<Record<string, () => void>>({});
  nativeActions.current = {
    answer: () => void acceptRef.current(),
    decline: () => declineCall(),
    hangup: () => hangupCall(),
    mute: () => toggleMute(),
    open: () => setMinimized(false),
  };
  useEffect(() => onNativeCallAction((action) => nativeActions.current[action]?.()), []);

  // Android: tie this phone's push token to the signed-in account.
  useEffect(() => {
    if (!me) return;
    return onAndroidToken((token) => {
      void fetch('/api/connect/push', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify({ subscription: { fcm: token, platform: 'android' } }) });
    });
  }, [me]);

  const [droidChecks, setDroidChecks] = useState<ReturnType<typeof androidChecks>>(null);
  useEffect(() => {
    if (nativePlatform() !== 'android') return;
    const check = () => setDroidChecks(androidChecks());
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
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
        if (data.people && data.people !== peopleStamp.current) {
          peopleStamp.current = data.people;
          void loadPeople();
          void loadContacts();
        }
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
      es.addEventListener('hello', (ev) => {
        failures = 0;
        setLive(true);
        try {
          const v = JSON.parse((ev as MessageEvent).data).version;
          if (v && APP_VERSION && v !== APP_VERSION) setUpdateReady(true);
        } catch {
          /* ignore */
        }
        stopFallback();
        void pollOnce(); // catch up on anything missed while disconnected
      });
      es.addEventListener('chat', (ev) => {
        void loadContacts();
        setRefreshKey((k) => k + 1);
        try {
          const d = JSON.parse((ev as MessageEvent).data);
          if (d.from && d.name) announce.current({ from: d.from, name: d.name, preview: d.preview || '' });
        } catch {
          /* ignore */
        }
      });
      // The other side received / read my messages: ✓✓ in the open chat.
      es.addEventListener('receipt', () => setRefreshKey((k) => k + 1));
      es.addEventListener('people', () => {
        void loadPeople();
        void loadContacts();
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
          else if (data.type === 'call' && incomingRef.current?.id === data.id && data.state !== 'ringing') endUi(data.state === 'active' ? 'elsewhere' : 'missed');
        } catch {
          /* ignore */
        }
      };
      es.addEventListener('call', toCall);
      es.addEventListener('ice', toCall);
      es.onerror = () => {
        failures += 1;
        setLive(false);
        // The browser reconnects by itself; after repeated failures use the backup.
        if (failures >= 3) startFallback();
      };
    };
    open();

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // Like the stores: look for a newer version each time the app comes back.
      void navigator.serviceWorker?.getRegistration('/connect').then((reg) => reg?.update()).catch(() => undefined);
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
  }, [me, loadContacts, loadPeople, endUi, showIncoming]);

  /* ---------- updates ---------- */
  // A newer version is online: apply it at a quiet moment (never during a call or
  // while typing). In the background it is silent; on screen a banner offers it.
  const applyUpdate = useCallback(async () => {
    if (callRef.current || incomingRef.current) return;
    try {
      const reg = await navigator.serviceWorker?.getRegistration('/connect');
      await reg?.update();
    } catch {
      /* the page update is enough */
    }
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!updateReady) return;
    const busyTyping = () =>
      [...document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>('.cn-app textarea, .cn-app input')].some(
        (el) => el.value.trim() && !el.closest('.cn-search')
      );
    const quietly = () => {
      if (document.visibilityState === 'hidden' && !busyTyping()) void applyUpdate();
    };
    quietly();
    document.addEventListener('visibilitychange', quietly);
    return () => document.removeEventListener('visibilitychange', quietly);
  }, [updateReady, applyUpdate]);

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
  useEffect(() => {
    if (vapid && typeof Notification !== 'undefined' && Notification.permission === 'granted') void enablePush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vapid]);

  const enablePush = async () => {
    // The Windows / Android apps ring by themselves; browser push is not used there.
    if (nativePlatform()) return setPushState('unsupported');
    try {
      if (!vapid) throw new Error('no key');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setPushState(permission === 'denied' ? 'denied' : 'off');
      const reg = await navigator.serviceWorker.register('/connect-sw.js', { scope: '/connect' });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) }));
      // Only "on" once the server really stored this device — otherwise calls cannot reach it.
      const res = await fetch('/api/connect/push', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (!res.ok) throw new Error(`push ${res.status}`);
      setPushFailed(false);
      setPushState('on');
    } catch {
      setPushFailed(true);
      setPushState(typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'denied' : 'off');
    }
  };

  /* ---------- view ---------- */
  const open = contacts.find((c) => c.id === openId) || null;
  const totalUnread = contacts.reduce((n, c) => n + c.unread, 0);

  // Unread count on the app icon (installed app) and in the window title.
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (totalUnread) void nav.setAppBadge?.(totalUnread).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = totalUnread ? `(${totalUnread}) ${base}` : base;
  }, [totalUnread]);
  const q = query.trim().toLowerCase();
  const filtered = contacts.filter((c) => !q || c.name.toLowerCase().includes(q) || c.roleLabel.includes(q));
  const chats = filtered.filter((c) => c.lastTs);
  const team = filtered.filter((c) => c.role !== 'PILGRIM_USER');
  const clients = filtered.filter((c) => c.role === 'PILGRIM_USER');
  // Favourites: the clients I accepted, the ones I talk to most (lately) first.
  const favourites = clients.filter((c) => c.friend).sort((a, b) => b.affinity - a.affinity || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'ar'));
  const requestCount = people.requests.length;

  if (needLogin) {
    return (
      <div className="cn-app cn-login" dir="rtl">
        <div className="cn-login-card">
          <img src="/icons/connect-192.png" alt="" />
          <h1>South Street Connect</h1>
          {/* No install before sign-in: the app is for account holders only. */}
          <p>رسائل ومكالمات صوتية بين المعتمرين وفريق الوكالة. سجّل الدخول بحسابك في ساوث ستريت لاستعمال التطبيق وتثبيته.</p>
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
            <button type="button" className="cn-icon" onClick={() => void refreshAll()} disabled={refreshing} title="تحديث" aria-label="تحديث">
              <RefreshCw className={`w-5 h-5${refreshing ? ' animate-spin' : ''}`} />
            </button>
            <button type="button" className="cn-icon" onClick={() => setAboutOpen(true)} title="حول التطبيق" aria-label="حول التطبيق">
              <Info className="w-5 h-5" />
            </button>
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

        {updateReady && !callView ? (
          <button type="button" className="cn-banner cn-update" onClick={() => void applyUpdate()}>
            <RefreshCw className="w-4 h-4" /> نسخة جديدة من التطبيق جاهزة — اضغط للتحديث
          </button>
        ) : null}

        {oldApp && !callView ? (
          <button type="button" className="cn-banner cn-update" onClick={() => void downloadNewApp()}>
            <Download className="w-4 h-4" /> إصدار جديد من التطبيق — اضغط للتنزيل ثم ثبّته (بعده يتحدّث التطبيق وحده)
          </button>
        ) : null}

        {droidChecks && !droidChecks.notifications ? (
          <button type="button" className="cn-banner" onClick={() => openAndroidSettings('notifications')}>
            <Bell className="w-4 h-4" /> الإشعارات متوقفة — اضغط لتفعيلها حتى يرنّ الهاتف عند الاتصال
          </button>
        ) : droidChecks && !droidChecks.fullScreen ? (
          <button type="button" className="cn-banner" onClick={() => openAndroidSettings('fullscreen')}>
            <Phone className="w-4 h-4" /> اسمح بشاشة المكالمة الكاملة — اضغط ثم فعّل «عرض بملء الشاشة»
          </button>
        ) : null}

        {(pushState === 'off' || pushState === 'denied') && vapid ? (
          <button type="button" className="cn-banner" onClick={() => void enablePush()}>
            <Bell className="w-4 h-4" /> فعّل الإشعارات لتصلك الرسائل والمكالمات والتطبيق مغلق
          </button>
        ) : null}

        <label className="cn-search">
          <Search className="w-4 h-4" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isClient ? 'بحث عن شخص بالاسم' : 'بحث'} />
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
          {tab === 'contacts' && isClient ? (
            <>
              <button type="button" className="cn-add" onClick={() => setAddOpen(true)}>
                <span><UserPlus className="w-5 h-5" /></span>
                <b>إضافة شخص</b>
                <small>برقم الهاتف أو البريد</small>
              </button>
              <RequestList people={people.requests} onAction={onPeopleAction} />
              {favourites.length ? (<><h3 className="cn-group"><Star className="w-3.5 h-3.5" aria-hidden /> المفضّلون</h3><ul>{favourites.map((c) => row(c, false))}</ul></>) : null}
              {team.length ? (<><h3 className="cn-group">فريق الوكالة</h3><ul>{team.map((c) => row(c, false))}</ul></>) : null}
              {!q ? <Suggestions people={people.suggestions} onAction={onPeopleAction} /> : null}
              {q && found ? (
                <Directory title="نتائج البحث" people={found} onAction={onPeopleAction} empty="لا يوجد عميل بهذا الاسم." />
              ) : !q ? (
                <Directory title={`كل العملاء (${people.everyone.length})`} people={people.everyone} onAction={onPeopleAction} />
              ) : null}
              {!q && !favourites.length && !people.suggestions.length && !people.everyone.length && !requestCount ? (
                <p className="cn-tip">أضف رفاق رحلتك ليظهروا هنا في «المفضّلون» — يقبلون طلبك ثم تتراسلون وتتصلون مجاناً.</p>
              ) : null}
              <SentAndBlocked sent={people.sent} blocked={people.blocked} onAction={onPeopleAction} />
            </>
          ) : null}
          {tab === 'contacts' && !isClient ? (
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
          <button type="button" className={tab === 'contacts' ? 'is-on' : ''} onClick={() => setTab('contacts')}><Users className="w-5 h-5" /> جهات الاتصال{requestCount ? <em className="cn-badge">{requestCount}</em> : null}</button>
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
            menu={isClient && open.friend ? <PersonMenu name={open.name} onAction={(a) => onPeopleAction(open.id, a)} /> : null}
          />
        ) : (
          <div className="cn-welcome">
            <img src="/icons/connect-192.png" alt="" />
            <h2>South Street Connect</h2>
            <p>اختر محادثة أو جهة اتصال. الرسائل والمكالمات الصوتية بين المعتمرين وفريق الوكالة.</p>
            <small className="cn-version" dir="ltr">v{versionLabel()}</small>
          </div>
        )}
      </main>

      {addOpen ? (
        <AddPersonSheet
          onClose={() => setAddOpen(false)}
          onAction={onPeopleAction}
          onOpenChat={(id) => { setOpenId(id); void loadContacts(); }}
        />
      ) : null}

      {me && !setupDone && !callView && nativePlatform() === 'android' ? (
        <AndroidSetup onDone={() => { setSetupDone(true); setDroidChecks(androidChecks()); }} />
      ) : null}

      {toast ? <div className="cn-toast" role="status">{toast}</div> : null}

      {banner && !(callView && !minimized) ? (
        <button
          key={banner.key}
          type="button"
          className="cn-msg-banner"
          role="status"
          onClick={() => {
            setOpenId(banner.from);
            setBanner(null);
          }}
        >
          <span className="cn-avatar">
            {(() => {
              const c = contacts.find((p) => p.id === banner.from);
              return c?.photo ? <img src={c.photo} alt="" /> : banner.name.charAt(0);
            })()}
          </span>
          <span className="cn-msg-banner-text">
            <b>{banner.name}</b>
            <small>{banner.preview}</small>
          </span>
          <MessageCircle className="w-5 h-5" aria-hidden />
        </button>
      ) : null}

      {aboutOpen ? (
        <AboutSheet onClose={() => setAboutOpen(false)} busy={Boolean(callView)} relay={iceServers.some((s) => ([] as string[]).concat(s.urls).some((u) => /^turns?:/.test(u)))} live={live} serverPush={Boolean(vapid)} pushState={pushState === 'denied' ? 'off' : pushState} onEnablePush={enablePush} onApplyWebUpdate={() => void applyUpdate()} />
      ) : null}

      {me && vapid && (pushState === 'off' || pushState === 'denied') && !gateLater && !callView ? (
        <NotifyGate denied={pushState === 'denied'} failed={pushFailed} onEnable={enablePush} onLater={() => setGateLater(true)} />
      ) : null}

      {callView && !minimized ? (
        <CallOverlay
          view={callView}
          onAccept={() => void acceptCall()}
          onDecline={declineCall}
          onHangup={hangupCall}
          onMute={toggleMute}
          onMinimize={() => setMinimized(true)}
          canPopOut={pip.supported}
          onPopOut={() => void popOutCall()}
          onSpeaker={canSwitchSpeaker() ? toggleSpeaker : undefined}
        />
      ) : null}

      {/* Minimised: a floating card in the page (when no Picture-in-Picture window is open). */}
      {callView && minimized && !pip.win ? (
        <CallMini view={callView} onHangup={hangupCall} onMute={toggleMute} onExpand={expandCall} />
      ) : null}

      {/* Windows / desktop: the same card in an always-on-top window over every app. */}
      {callView && pip.win
        ? createPortal(<CallMini inPip view={callView} onHangup={hangupCall} onMute={toggleMute} onExpand={expandCall} />, pip.win.document.body)
        : null}
    </div>
  );
}

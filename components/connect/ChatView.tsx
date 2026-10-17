'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bell, BellOff, Check, CheckCheck, Lock, Loader2, Megaphone, Mic, Pause, Phone, PhoneIncoming, PhoneMissed, Play, Send, Trash2, Users } from 'lucide-react';
import { authHeaders, jsonAuthHeaders } from '@/lib/api-client';
import type { ConnectContact, ConnectMessage } from '@/lib/connect/store';
import type { MyGroup } from '@/lib/connect/groups';

const VOICE_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
const MAX_VOICE_SEC = 180;

function clock(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

function timeOf(ts: number) {
  return ts ? new Date(ts).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }) : '';
}

function dayOf(ts: number) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'اليوم';
  if (d.toDateString() === y.toDateString()) return 'أمس';
  return d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long' });
}

/** «آخر ظهور»: when the other person last had the app connected. */
function seenText(ts: number) {
  if (!ts) return '';
  const ago = Date.now() - ts;
  if (ago < 120_000) return 'آخر ظهور قبل لحظات';
  const d = new Date(ts);
  const time = d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `آخر ظهور اليوم ${time}`;
  if (d.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return `آخر ظهور أمس ${time}`;
  return `آخر ظهور ${d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' })}`;
}

/** In a group: ✓ nobody read it yet · ✓✓ some read it · blue ✓✓ everyone did (count on hover). */
function GroupTicks({ ts, reads }: { ts: number; reads: number[] }) {
  const n = reads.filter((r) => r >= ts).length;
  const label = `قرأها ${n} من ${reads.length}`;
  if (reads.length && n === reads.length) return <span className="cn-ticks is-read" title={label} aria-label={label}><CheckCheck className="w-3.5 h-3.5" /></span>;
  if (n) return <span className="cn-ticks" title={label} aria-label={label}><CheckCheck className="w-3.5 h-3.5" /></span>;
  return <span className="cn-ticks" title={label} aria-label={label}><Check className="w-3.5 h-3.5" /></span>;
}

/** ✓ sent · ✓✓ reached their phone · blue ✓✓ read. */
function Ticks({ ts, receipt }: { ts: number; receipt: { delivered: number; read: number } }) {
  if (ts <= receipt.read) return <span className="cn-ticks is-read" aria-label="مقروءة"><CheckCheck className="w-3.5 h-3.5" /></span>;
  if (ts <= receipt.delivered) return <span className="cn-ticks" aria-label="وصلت"><CheckCheck className="w-3.5 h-3.5" /></span>;
  return <span className="cn-ticks" aria-label="أُرسلت"><Check className="w-3.5 h-3.5" /></span>;
}

/** A voice note with its own play / pause and progress. */
function VoiceNote({ src, duration }: { src: string; duration?: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <div className="cn-voice">
      <button type="button" onClick={() => (playing ? ref.current?.pause() : void ref.current?.play())} aria-label={playing ? 'إيقاف' : 'تشغيل'}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <span className="cn-voice-bar"><i style={{ width: `${progress}%` }} /></span>
      <small dir="ltr">{clock(duration || 0)}</small>
      <audio
        ref={ref}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          const total = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : duration || 1;
          setProgress(Math.min(100, (a.currentTime / total) * 100));
        }}
      />
    </div>
  );
}

export default function ChatView({
  me,
  peer,
  onBack,
  onCall,
  refreshKey,
  onChanged,
  menu,
  group,
}: {
  me: { id: string };
  peer: ConnectContact;
  onBack: () => void;
  /** Absent: no call button (a group, or calls switched off by the Super Admin). */
  onCall?: () => void;
  /** A group chat (made in /connect-admin): who wrote what, who read it, may I write. */
  group?: MyGroup;
  refreshKey: number;
  onChanged: () => void;
  /** Extra header control (⋮ remove / block for another client). */
  menu?: React.ReactNode;
}) {
  const [messages, setMessages] = useState<ConnectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(peer.online);
  const [seen, setSeen] = useState(peer.lastSeen || 0);
  const [receipt, setReceipt] = useState({ delivered: 0, read: 0 });
  // Group chat: members' names, when each other member last read, may I write, muted.
  const [names, setNames] = useState<Record<string, string>>({});
  const [reads, setReads] = useState<number[]>([]);
  const [canWrite, setCanWrite] = useState(true);
  const [muted, setMuted] = useState(Boolean(group?.muted));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const lastTs = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recTimer = useRef(0);
  const discard = useRef(false);
  const startedAt = useRef(0);

  const load = async (full = false) => {
    try {
      const since = full ? 0 : lastTs.current;
      const res = await fetch(
        group ? `/api/connect/groups?id=${encodeURIComponent(group.id)}&since=${since}` : `/api/connect/messages?with=${encodeURIComponent(peer.id)}&since=${since}`,
        { headers: authHeaders(), cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذّر التحميل');
      if (group) {
        setNames(Object.fromEntries((data.members || []).map((m: { id: string; name: string }) => [m.id, m.name])));
        setReads(data.reads || []);
        setCanWrite(Boolean(data.canPost));
      }
      setOnline(Boolean(data.peerOnline));
      if (data.peerSeen) setSeen(Number(data.peerSeen));
      if (data.receipt) setReceipt({ delivered: Number(data.receipt.delivered) || 0, read: Number(data.receipt.read) || 0 });
      const incoming: ConnectMessage[] = data.messages || [];
      if (incoming.length) lastTs.current = Math.max(lastTs.current, ...incoming.map((m) => m.ts));
      setMessages((prev) => {
        if (full) return incoming;
        const known = new Set(prev.map((m) => m.id));
        return [...prev, ...incoming.filter((m) => !known.has(m.id))];
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    lastTs.current = 0;
    setReceipt({ delivered: 0, read: 0 });
    setSeen(peer.lastSeen || 0);
    setNames({});
    setReads([]);
    setCanWrite(group ? group.canPost : true);
    setMuted(Boolean(group?.muted));
    setLoading(true);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer.id]);

  // The Super Admin changed the group (announcements only, closed, reopened): follow it at once.
  useEffect(() => {
    if (group) setCanWrite(group.canPost);
  }, [group?.canPost]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (refreshKey) void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const sendText = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError('');
    try {
      const res = group
        ? await fetch('/api/connect/groups', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify({ id: group.id, text: value }) })
        : await fetch('/api/connect/messages', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify({ to: peer.id, text: value }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذّر الإرسال');
      setText('');
      setMessages((prev) => [...prev, data.message]);
      lastTs.current = Math.max(lastTs.current, data.message.ts);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      const mimeType = VOICE_TYPES.find((m) => MediaRecorder.isTypeSupported?.(m));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined);
      chunks.current = [];
      discard.current = false;
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(recTimer.current);
        setRecording(false);
        const seconds = Math.round((Date.now() - startedAt.current) / 1000);
        if (discard.current || seconds < 1) return;
        const blob = new Blob(chunks.current, { type: (rec.mimeType || mimeType || 'audio/webm').split(';')[0] });
        const form = new FormData();
        if (group) form.append('group', group.id);
        else form.append('to', peer.id);
        form.append('duration', String(seconds));
        form.append('audio', blob, `voice.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`);
        setSending(true);
        try {
          const res = await fetch('/api/connect/voice', { method: 'POST', headers: authHeaders(), body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'تعذّر إرسال الرسالة الصوتية');
          setMessages((prev) => [...prev, data.message]);
          lastTs.current = Math.max(lastTs.current, data.message.ts);
          onChanged();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setSending(false);
        }
      };
      recorder.current = rec;
      startedAt.current = Date.now();
      rec.start(250);
      setRecSec(0);
      setRecording(true);
      recTimer.current = window.setInterval(() => {
        const s = Math.round((Date.now() - startedAt.current) / 1000);
        setRecSec(s);
        if (s >= MAX_VOICE_SEC) recorder.current?.stop();
      }, 500);
    } catch {
      setError('اسمح باستعمال الميكروفون لإرسال رسالة صوتية.');
    }
  };

  const stopRecording = (send: boolean) => {
    discard.current = !send;
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  const toggleMute = async () => {
    if (!group) return;
    const next = !muted;
    setMuted(next);
    const res = await fetch('/api/connect/groups', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify({ id: group.id, action: next ? 'mute' : 'unmute' }) }).catch(() => null);
    if (!res?.ok) setMuted(!next);
    else onChanged();
  };

  const groupSub = group ? (group.closed ? 'مجموعة مغلقة' : group.mode === 'admins' ? `${group.members} عضو · إعلانات` : `${group.members} عضو`) : '';

  let lastDay = '';
  return (
    <section className="cn-chat">
      <header className="cn-chat-head">
        <button type="button" className="cn-icon" onClick={onBack} aria-label="رجوع"><ArrowRight className="w-5 h-5" /></button>
        <span className={`cn-avatar${group ? ' is-group' : ''}`}>{group ? <Users className="w-5 h-5" /> : peer.photo ? <img src={peer.photo} alt="" /> : peer.name.charAt(0)}{!group && online ? <i className="cn-dot" /> : null}</span>
        <div className="cn-chat-title">
          <b>{peer.name}</b>
          <small>{group ? groupSub : online ? 'متصل الآن' : seen ? seenText(seen) : peer.friend ? 'من المفضّلين' : peer.roleLabel}</small>
        </div>
        {group ? (
          <button type="button" className="cn-icon" onClick={() => void toggleMute()} aria-label={muted ? 'تشغيل إشعارات المجموعة' : 'كتم إشعارات المجموعة'} title={muted ? 'الإشعارات مكتومة' : 'كتم الإشعارات'}>
            {muted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          </button>
        ) : null}
        {onCall ? <button type="button" className="cn-icon is-call" onClick={onCall} aria-label="اتصال صوتي"><Phone className="w-5 h-5" /></button> : null}
        {menu}
      </header>

      <div className="cn-messages">
        {loading ? <div className="cn-center"><Loader2 className="w-5 h-5 animate-spin" /></div> : null}
        {!loading && !messages.length ? (
          <p className="cn-hint">{group ? (group.description || `مجموعة «${peer.name}» — ${group.members} عضو.`) : `ابدأ المحادثة مع ${peer.name} — رسالة نصية أو صوتية أو مكالمة.`}</p>
        ) : null}
        {messages.map((m) => {
          const day = dayOf(m.ts);
          const showDay = day && day !== lastDay;
          if (day) lastDay = day;
          const mine = m.senderId === me.id;
          return (
            <div key={m.id}>
              {showDay ? <p className="cn-day">{day}</p> : null}
              {m.kind === 'call' ? (
                <p className={`cn-call-log${/فائتة|مرفوضة/.test(m.text) ? ' is-missed' : ''}`}>
                  {/فائتة|مرفوضة/.test(m.text) ? <PhoneMissed className="w-4 h-4" /> : <PhoneIncoming className="w-4 h-4" />}
                  {m.text}{m.duration ? ` · ${clock(m.duration)}` : ''} · {timeOf(m.ts)}
                </p>
              ) : (
                <div className={`cn-bubble ${mine ? 'is-mine' : 'is-theirs'}`}>
                  {group && !mine ? <span className="cn-bubble-from">{names[m.senderId] || '—'}</span> : null}
                  {m.kind === 'voice' && m.mediaId ? <VoiceNote src={`/api/connect/media/${m.mediaId}`} duration={m.duration} /> : <p>{m.text}</p>}
                  <small>{timeOf(m.ts)}{mine ? (group ? <GroupTicks ts={m.ts} reads={reads} /> : <Ticks ts={m.ts} receipt={receipt} />) : null}</small>
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error ? <p className="cn-error" role="alert">{error}</p> : null}

      {group && !canWrite ? (
        <p className="cn-readonly">
          {group.closed ? <Lock className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />}
          {group.closed ? 'أغلقت الإدارة هذه المجموعة — للقراءة فقط.' : 'المشرفون فقط يكتبون في هذه المجموعة.'}
        </p>
      ) : recording ? (
        <div className="cn-composer is-recording">
          <button type="button" className="cn-icon" onClick={() => stopRecording(false)} aria-label="إلغاء"><Trash2 className="w-5 h-5" /></button>
          <span className="cn-rec-dot" />
          <span className="cn-rec-time" dir="ltr">{clock(recSec)}</span>
          <span className="cn-rec-label">جاري التسجيل…</span>
          <button type="button" className="cn-send" onClick={() => stopRecording(true)} aria-label="إرسال"><Send className="w-5 h-5" /></button>
        </div>
      ) : (
        <form className="cn-composer" onSubmit={(e) => { e.preventDefault(); void sendText(); }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                e.preventDefault();
                void sendText();
              }
            }}
            rows={1}
            placeholder="اكتب رسالة"
            maxLength={4000}
          />
          {text.trim() ? (
            <button type="submit" className="cn-send" disabled={sending} aria-label="إرسال">{sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</button>
          ) : (
            <button type="button" className="cn-send" onClick={() => void startRecording()} disabled={sending} aria-label="رسالة صوتية">{sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}</button>
          )}
        </form>
      )}
    </section>
  );
}

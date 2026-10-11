'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, Mic, Pause, Phone, PhoneIncoming, PhoneMissed, Play, Send, Trash2 } from 'lucide-react';
import { authHeaders, jsonAuthHeaders } from '@/lib/api-client';
import type { ConnectContact, ConnectMessage } from '@/lib/connect/store';

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
}: {
  me: { id: string };
  peer: ConnectContact;
  onBack: () => void;
  onCall: () => void;
  refreshKey: number;
  onChanged: () => void;
}) {
  const [messages, setMessages] = useState<ConnectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(peer.online);
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
      const res = await fetch(`/api/connect/messages?with=${encodeURIComponent(peer.id)}&since=${since}`, { headers: authHeaders(), cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذّر التحميل');
      setOnline(Boolean(data.peerOnline));
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
    setLoading(true);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer.id]);

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
      const res = await fetch('/api/connect/messages', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify({ to: peer.id, text: value }) });
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
        form.append('to', peer.id);
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

  let lastDay = '';
  return (
    <section className="cn-chat">
      <header className="cn-chat-head">
        <button type="button" className="cn-icon" onClick={onBack} aria-label="رجوع"><ArrowRight className="w-5 h-5" /></button>
        <span className="cn-avatar">{peer.photo ? <img src={peer.photo} alt="" /> : peer.name.charAt(0)}{online ? <i className="cn-dot" /> : null}</span>
        <div className="cn-chat-title">
          <b>{peer.name}</b>
          <small>{online ? 'متصل الآن' : peer.roleLabel}</small>
        </div>
        <button type="button" className="cn-icon is-call" onClick={onCall} aria-label="اتصال صوتي"><Phone className="w-5 h-5" /></button>
      </header>

      <div className="cn-messages">
        {loading ? <div className="cn-center"><Loader2 className="w-5 h-5 animate-spin" /></div> : null}
        {!loading && !messages.length ? <p className="cn-hint">ابدأ المحادثة مع {peer.name} — رسالة نصية أو صوتية أو مكالمة.</p> : null}
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
                  {m.kind === 'voice' && m.mediaId ? <VoiceNote src={`/api/connect/media/${m.mediaId}`} duration={m.duration} /> : <p>{m.text}</p>}
                  <small>{timeOf(m.ts)}</small>
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error ? <p className="cn-error" role="alert">{error}</p> : null}

      {recording ? (
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

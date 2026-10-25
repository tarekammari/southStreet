'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Lock, Maximize2, Mic, MicOff, Phone, PhoneOff, PictureInPicture2, ShieldAlert, Volume1, Volume2 } from 'lucide-react';
import type { CallPhase, CallQuality, CallSecurity } from '@/lib/connect/rtc';
import { connectName } from '@/lib/brand';
import { useBrand } from '@/components/social/useAgencyInfo';

export type CallView = {
  peerName: string;
  peerPhoto?: string;
  peerRole?: string;
  phase: CallPhase | 'incoming';
  connectedAt?: number;
  muted: boolean;
  /** Loudspeaker on (Android app; otherwise the earpiece, like a phone call). */
  speaker?: boolean;
  note?: string;
  /** Signal bars during the call. */
  quality?: CallQuality;
  /** End-to-end check and the security code both screens show. */
  security?: CallSecurity;
};

const LABEL: Record<string, string> = {
  calling: 'جارٍ الاتصال…',
  ringing: 'يرنّ…',
  connecting: 'جارٍ الوصل…',
  reconnecting: 'جارٍ إعادة الاتصال…',
  incoming: 'مكالمة صوتية واردة',
  ended: 'انتهت المكالمة',
};

/** "1:05" while in call, otherwise the phase label. Re-renders every second during a call. */
export function useCallStatus(view: CallView): string {
  const [, tick] = useState(0);
  useEffect(() => {
    if (view.phase !== 'active') return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [view.phase]);
  const seconds = view.connectedAt ? Math.floor((Date.now() - view.connectedAt) / 1000) : 0;
  return view.phase === 'active'
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    : view.note || LABEL[view.phase] || '';
}

const QUALITY_LABEL: Record<CallQuality['level'], string> = { good: 'الاتصال ممتاز', fair: 'الاتصال متوسط', poor: 'الاتصال ضعيف' };

/** Three signal bars, like a phone's reception. */
function Bars({ quality }: { quality: CallQuality }) {
  const n = quality.level === 'good' ? 3 : quality.level === 'fair' ? 2 : 1;
  return (
    <span className={`cn-bars is-${quality.level}`} role="img" aria-label={QUALITY_LABEL[quality.level]} title={`${QUALITY_LABEL[quality.level]}${quality.relayed ? ' · عبر خادم الوصل' : ''}`}>
      {[1, 2, 3].map((i) => <i key={i} className={i <= n ? 'is-on' : ''} />)}
    </span>
  );
}

/**
 * «مشفّرة من طرف إلى طرف» with the 4-emoji code. Same emojis on both phones =
 * nobody in the middle. A new device of the other person, or an unsigned setup,
 * is said plainly.
 */
function Security({ security }: { security: CallSecurity }) {
  const [open, setOpen] = useState(false);
  const warn = security.check !== 'verified' || security.peerKey === 'new-device';
  return (
    <div className={`cn-sec${warn ? ' is-warn' : ''}`}>
      <button type="button" className="cn-sec-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {warn ? <ShieldAlert className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
        <span>مشفّرة من طرف إلى طرف</span>
        {security.code ? <bdi className="cn-sec-code" aria-label="رمز الأمان">{security.code.join(' ')}</bdi> : null}
      </button>
      {open ? (
        <p className="cn-sec-note">
          {security.check === 'unsigned'
            ? 'الطرف الآخر يستعمل إصدارًا قديمًا لا يوقّع المكالمة. الصوت مشفّر، لكن قارن الرمز للتأكد.'
            : security.peerKey === 'new-device'
              ? 'هذا الشخص يتصل من جهاز جديد. قارنا الرموز: إن تطابقت فالمكالمة بينكما فقط.'
              : 'الصوت مشفّر بين الهاتفين فقط — لا الخادم ولا أي طرف آخر يستطيع سماعه. للتأكد قارنا الرموز: يجب أن تكون نفسها على الهاتفين.'}
        </p>
      ) : null}
    </div>
  );
}

function Avatar({ view, className }: { view: CallView; className: string }) {
  return <span className={className}>{view.peerPhoto ? <img src={view.peerPhoto} alt="" /> : view.peerName.charAt(0)}</span>;
}

/** Full-screen call screen (incoming, ringing, in call) — like a phone's own call app. */
export default function CallOverlay({
  view,
  onAccept,
  onDecline,
  onHangup,
  onMute,
  onMinimize,
  canPopOut,
  onPopOut,
  onSpeaker,
}: {
  view: CallView;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onMute: () => void;
  onMinimize?: () => void;
  canPopOut?: boolean;
  onPopOut?: () => void;
  /** Shown only where the app can switch earpiece / loudspeaker. */
  onSpeaker?: () => void;
}) {
  const brand = useBrand();
  const status = useCallStatus(view);
  const incoming = view.phase === 'incoming';
  const live = !incoming && view.phase !== 'ended';

  return (
    <div className={`cn-call is-${view.phase}`} role="dialog" aria-modal="true" aria-label={`مكالمة مع ${view.peerName}`}>
      {view.peerPhoto ? <div className="cn-call-backdrop" style={{ backgroundImage: `url("${view.peerPhoto}")` }} aria-hidden /> : null}

      <div className="cn-call-bar">
        {live && onMinimize ? (
          <button type="button" className="cn-call-chip" onClick={onMinimize} aria-label="تصغير المكالمة">
            <ChevronDown className="w-5 h-5" />
          </button>
        ) : <span />}
        <span className="cn-call-brand">
          <img src="/icons/connect-192.png" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          {connectName(brand)}
        </span>
        {live && canPopOut && onPopOut ? (
          <button type="button" className="cn-call-chip" onClick={onPopOut} aria-label="نافذة عائمة" title="نافذة عائمة فوق كل النوافذ">
            <PictureInPicture2 className="w-5 h-5" />
          </button>
        ) : <span />}
      </div>

      <div className="cn-call-top">
        <div className="cn-call-halo">
          {incoming || view.phase === 'calling' || view.phase === 'ringing' || view.phase === 'reconnecting' ? (
            <>
              <i className="cn-ripple" />
              <i className="cn-ripple" />
              <i className="cn-ripple" />
            </>
          ) : null}
          <Avatar view={view} className="cn-call-avatar" />
        </div>
        <h2>{view.peerName}</h2>
        {view.peerRole ? <p className="cn-call-role">{view.peerRole}</p> : null}
        <p className="cn-call-status" dir={view.phase === 'active' ? 'ltr' : undefined}>
          {incoming ? <Phone className="w-4 h-4 cn-shake" aria-hidden /> : null}
          {status}
          {view.phase === 'active' && view.quality ? <Bars quality={view.quality} /> : null}
        </p>
        {(view.phase === 'active' || view.phase === 'reconnecting') && view.security ? <Security security={view.security} /> : null}
      </div>

      {incoming ? (
        <div className="cn-call-actions is-incoming">
          <button type="button" className="cn-call-btn is-decline" onClick={onDecline} aria-label="رفض">
            <PhoneOff className="w-8 h-8" /><span>رفض</span>
          </button>
          <button type="button" className="cn-call-btn is-accept" onClick={onAccept} aria-label="رد">
            <Phone className="w-8 h-8" /><span>رد</span>
          </button>
        </div>
      ) : view.phase === 'ended' ? <div /> : (
        <div className="cn-call-actions">
          <button type="button" className={`cn-call-btn is-soft${view.muted ? ' is-on' : ''}`} onClick={onMute} aria-label={view.muted ? 'تشغيل الميكروفون' : 'كتم'} aria-pressed={view.muted}>
            {view.muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}<span>{view.muted ? 'مكتوم' : 'كتم'}</span>
          </button>
          {onSpeaker ? (
            <button type="button" className={`cn-call-btn is-soft${view.speaker ? ' is-on' : ''}`} onClick={onSpeaker} aria-label="مكبّر الصوت" aria-pressed={Boolean(view.speaker)}>
              {view.speaker ? <Volume2 className="w-6 h-6" /> : <Volume1 className="w-6 h-6" />}<span>مكبّر الصوت</span>
            </button>
          ) : null}
          <button type="button" className="cn-call-btn is-decline" onClick={onHangup} aria-label="إنهاء"><PhoneOff className="w-7 h-7" /><span>إنهاء</span></button>
        </div>
      )}
    </div>
  );
}

/** Compact call card: floating in the page, or alone in the Picture-in-Picture window. */
export function CallMini({
  view,
  onHangup,
  onMute,
  onExpand,
  inPip = false,
}: {
  view: CallView;
  onHangup: () => void;
  onMute: () => void;
  onExpand: () => void;
  inPip?: boolean;
}) {
  const status = useCallStatus(view);
  return (
    <div className={`cn-mini is-${view.phase}${inPip ? ' is-pip' : ''}`} dir="rtl" role="region" aria-label={`مكالمة مع ${view.peerName}`}>
      <button type="button" className="cn-mini-who" onClick={onExpand} aria-label="فتح شاشة المكالمة">
        <Avatar view={view} className="cn-mini-avatar" />
        <span className="cn-mini-text">
          <b>{view.peerName}</b>
          <small dir={view.phase === 'active' ? 'ltr' : undefined}>
            <i className="cn-mini-dot" />{status}
          </small>
        </span>
      </button>
      {view.phase !== 'ended' ? (
        <div className="cn-mini-actions">
          <button type="button" className={`cn-mini-btn${view.muted ? ' is-on' : ''}`} onClick={onMute} aria-label={view.muted ? 'تشغيل الميكروفون' : 'كتم'} aria-pressed={view.muted}>
            {view.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          {!inPip ? (
            <button type="button" className="cn-mini-btn" onClick={onExpand} aria-label="تكبير"><Maximize2 className="w-4 h-4" /></button>
          ) : null}
          <button type="button" className="cn-mini-btn is-end" onClick={onHangup} aria-label="إنهاء"><PhoneOff className="w-4 h-4" /></button>
        </div>
      ) : null}
    </div>
  );
}

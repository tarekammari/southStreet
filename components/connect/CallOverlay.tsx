'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Maximize2, Mic, MicOff, Phone, PhoneOff, PictureInPicture2 } from 'lucide-react';
import type { CallPhase } from '@/lib/connect/rtc';

export type CallView = {
  peerName: string;
  peerPhoto?: string;
  peerRole?: string;
  phase: CallPhase | 'incoming';
  connectedAt?: number;
  muted: boolean;
  note?: string;
};

const LABEL: Record<string, string> = {
  calling: 'جارٍ الاتصال…',
  ringing: 'يرنّ…',
  connecting: 'جارٍ الوصل…',
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
}: {
  view: CallView;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onMute: () => void;
  onMinimize?: () => void;
  canPopOut?: boolean;
  onPopOut?: () => void;
}) {
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
          South Street Connect
        </span>
        {live && canPopOut && onPopOut ? (
          <button type="button" className="cn-call-chip" onClick={onPopOut} aria-label="نافذة عائمة" title="نافذة عائمة فوق كل النوافذ">
            <PictureInPicture2 className="w-5 h-5" />
          </button>
        ) : <span />}
      </div>

      <div className="cn-call-top">
        <div className="cn-call-halo">
          {incoming || view.phase === 'calling' || view.phase === 'ringing' ? (
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
        </p>
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

'use client';

import { useEffect, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
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

/** Full-screen call screen (incoming, ringing, in call). */
export default function CallOverlay({
  view,
  onAccept,
  onDecline,
  onHangup,
  onMute,
}: {
  view: CallView;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onMute: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (view.phase !== 'active') return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [view.phase]);

  const seconds = view.connectedAt ? Math.floor((Date.now() - view.connectedAt) / 1000) : 0;
  const status = view.phase === 'active' ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : view.note || LABEL[view.phase] || '';

  return (
    <div className={`cn-call is-${view.phase}`} role="dialog" aria-modal="true" aria-label={`مكالمة مع ${view.peerName}`}>
      <div className="cn-call-top">
        <span className="cn-call-avatar">{view.peerPhoto ? <img src={view.peerPhoto} alt="" /> : view.peerName.charAt(0)}</span>
        <h2>{view.peerName}</h2>
        {view.peerRole ? <p className="cn-call-role">{view.peerRole}</p> : null}
        <p className="cn-call-status" dir={view.phase === 'active' ? 'ltr' : undefined}>{status}</p>
      </div>
      {view.phase === 'incoming' ? (
        <div className="cn-call-actions">
          <button type="button" className="cn-call-btn is-decline" onClick={onDecline} aria-label="رفض"><PhoneOff className="w-7 h-7" /><span>رفض</span></button>
          <button type="button" className="cn-call-btn is-accept" onClick={onAccept} aria-label="رد"><Phone className="w-7 h-7" /><span>رد</span></button>
        </div>
      ) : view.phase === 'ended' ? null : (
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

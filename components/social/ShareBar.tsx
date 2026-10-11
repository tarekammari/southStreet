'use client';

/**
 * Share a page or a program: the phone's own share sheet when available
 * (WhatsApp, Messenger, Instagram…), plus direct WhatsApp / Facebook /
 * Telegram buttons and "copy link". Links carry UTM tags.
 */
import { useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';
import { shareUrl, withUtm } from '@/lib/social';
import { FacebookIcon, TelegramIcon, WhatsAppIcon } from './SocialIcons';

export default function ShareBar({ url, text, compact = false, className = '' }: { url?: string; text: string; compact?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const link = () => (url && /^https?:/.test(url) ? url : `${window.location.origin}${url || window.location.pathname}`);

  const native = async () => {
    try {
      await navigator.share({ title: text, text, url: withUtm(link(), 'native', 'share') });
    } catch {
      /* cancelled */
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(withUtm(link(), 'copy', 'share'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };
  const open = (target: 'whatsapp' | 'facebook' | 'telegram') => window.open(shareUrl(target, link(), text), '_blank', 'noopener,noreferrer');
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className={`ss-share${compact ? ' is-compact' : ''} ${className}`} role="group" aria-label="مشاركة">
      {!compact ? <span className="ss-share-label">مشاركة</span> : null}
      <button type="button" className="ss-share-btn is-wa" onClick={() => open('whatsapp')} aria-label="مشاركة على واتساب" title="واتساب"><WhatsAppIcon /></button>
      <button type="button" className="ss-share-btn is-fb" onClick={() => open('facebook')} aria-label="مشاركة على فيسبوك" title="فيسبوك"><FacebookIcon /></button>
      {!compact ? <button type="button" className="ss-share-btn is-tg" onClick={() => open('telegram')} aria-label="مشاركة على تيليغرام" title="تيليغرام"><TelegramIcon /></button> : null}
      <button type="button" className="ss-share-btn" onClick={copy} aria-label="نسخ الرابط" title={copied ? 'تم النسخ' : 'نسخ الرابط'}>
        {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
      </button>
      {canNative ? (
        <button type="button" className="ss-share-btn" onClick={native} aria-label="مشاركة عبر الهاتف" title="المزيد"><Share2 className="w-4 h-4" /></button>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Phone, Printer } from 'lucide-react';
import PhoneQr from '@/components/PhoneQr';
import { useAgencyInfo } from '@/components/social/useAgencyInfo';
import './qr-poster.css';

/**
 * Printable QR poster (A4): put it on the office counter, in brochures or at
 * fairs; walk-in clients scan it and land on the site. Options in the address:
 *   /qr                       the home page
 *   /qr?to=/packages          a page of the site (here: the programmes)
 */
const TARGETS: Record<string, { headline: string; line: string }> = {
  '/': { headline: 'امسح الرمز بكاميرا هاتفك', line: 'برامج العمرة والحج، الحجز، ومتابعة رحلتك مع الوكالة' },
  '/packages': { headline: 'برامجنا على هاتفك', line: 'كل برامج العمرة والحج بالأسعار والمقاعد المتبقية' },
  '/app': { headline: 'ثبّت تطبيق South Street Connect', line: 'رسائل ومكالمات مع الوكالة ومرشدك' },
};

export default function QrPoster() {
  const agency = useAgencyInfo();
  const [to, setTo] = useState('/');
  const [host, setHost] = useState('');

  useEffect(() => {
    setHost(window.location.host);
    const wanted = new URLSearchParams(window.location.search).get('to') || '/';
    setTo(wanted.startsWith('/') && !wanted.startsWith('//') ? wanted : '/');
  }, []);

  const copy = TARGETS[to] || { headline: 'امسح الرمز بكاميرا هاتفك', line: 'لتفتح الصفحة على هاتفك' };

  return (
    <main className="qrp" dir="rtl">
      <div className="qrp-tools">
        <label>
          الصفحة:
          <select value={TARGETS[to] ? to : '/'} onChange={(e) => setTo(e.target.value)}>
            <option value="/">الصفحة الرئيسية</option>
            <option value="/packages">البرامج</option>
            <option value="/app">تطبيق Connect</option>
          </select>
        </label>
        <button type="button" onClick={() => window.print()}>
          <Printer className="w-4 h-4" aria-hidden /> طباعة الملصق
        </button>
      </div>

      <article className="qrp-sheet">
        <img className="qrp-logo" src="/images/south_street_logo_trans.png" alt="South Street" />
        <p className="qrp-agency">{agency?.agency_name || 'وكالة ساوث ستريت للأسفار والعمرة'}</p>

        <h1>{copy.headline}</h1>
        <p className="qrp-line">{copy.line}</p>

        <div className="qrp-code">
          <PhoneQr path={to} source="poster" size={300} label="رمز QR لفتح الموقع" />
        </div>
        <p className="qrp-url" dir="ltr">{host}{to === '/' ? '' : to}</p>

        <ol className="qrp-steps">
          <li><b>1</b> افتح كاميرا الهاتف</li>
          <li><b>2</b> وجّهها نحو الرمز</li>
          <li><b>3</b> اضغط على الرابط الظاهر</li>
        </ol>

        {agency?.phone ? (
          <p className="qrp-contact">
            <Phone /> <span dir="ltr">{agency.phone}</span>
          </p>
        ) : null}
      </article>
    </main>
  );
}

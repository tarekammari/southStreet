'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useBrand } from '@/components/social/useAgencyInfo';

/**
 * QR code that opens this site on a phone (made in the browser, so it always
 * points to the address the visitor is on). The agency mark sits in the centre;
 * the high error-correction level keeps the code readable under it.
 * `source` is recorded as utm_medium, to see which QR people scan.
 */
export default function PhoneQr({
  path = '/',
  source = 'qr',
  size = 140,
  className = '',
  label = 'رمز QR لفتح الموقع على الهاتف',
}: {
  path?: string;
  source?: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  const brand = useBrand();
  const [src, setSrc] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    const target = new URL(path, window.location.origin);
    target.searchParams.set('utm_source', 'qr');
    target.searchParams.set('utm_medium', source);
    setUrl(target.toString());
    void QRCode.toDataURL(target.toString(), {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: size * 2, // sharp on high-density screens and in print
      color: { dark: '#064e3b', light: '#ffffff' },
    }).then(setSrc);
  }, [path, source, size]);

  return (
    <span className={`phone-qr ${className}`} style={{ width: size, height: size }} data-url={url}>
      {src ? <img src={src} alt={label} width={size} height={size} /> : <span className="phone-qr-placeholder" />}
      <span className="phone-qr-logo" aria-hidden>
        <img src={brand.mark_url} alt="" />
      </span>
    </span>
  );
}

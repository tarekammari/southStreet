import QRCode from 'qrcode';

/**
 * The account sign-in QR («رمز QR للدخول السريع»): a link that any phone camera
 * opens — /app#ssqr=SSQR1… — so scanning signs in on the site. The secret sits
 * after "#", which browsers never send to the server (no access logs), and the
 * page removes it from the address bar at once. The site's own scanner still
 * reads the bare SSQR1… text of older codes.
 */
export function siteOrigin(req: Request): string {
  const fromEnv = String(process.env.APP_ORIGIN || '').split(',')[0].trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

export function loginQrLink(payload: string, req: Request): string {
  return `${siteOrigin(req)}/app#ssqr=${payload}`;
}

/** A PNG data URL made on our own server (the secret never goes to a QR web service). */
export async function loginQrImage(payload: string, req: Request): Promise<string> {
  return QRCode.toDataURL(loginQrLink(payload, req), {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

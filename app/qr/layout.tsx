import type { Metadata } from 'next';

/** Printable QR poster for the agency (office counter, brochures, fairs). Not for search engines. */
export const metadata: Metadata = {
  title: 'ملصق QR — ساوث ستريت',
  description: 'امسح الرمز بكاميرا هاتفك لتصل إلى موقع وكالة ساوث ستريت.',
  robots: { index: false, follow: false },
};

export default function QrLayout({ children }: { children: React.ReactNode }) {
  return children;
}

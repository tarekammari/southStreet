import type { Metadata } from 'next';
import { agencyLabel } from '@/lib/brand';
import { getBrand } from '@/lib/brand-server';

/** Printable QR poster for the agency (office counter, brochures, fairs). Not for search engines. */
export function generateMetadata(): Metadata {
  const brand = getBrand();
  return {
    title: { absolute: `ملصق QR — ${brand.short_name}` },
    description: `امسح الرمز بكاميرا هاتفك لتصل إلى موقع ${agencyLabel(brand)}.`,
    robots: { index: false, follow: false },
  };
}

export default function QrLayout({ children }: { children: React.ReactNode }) {
  return children;
}

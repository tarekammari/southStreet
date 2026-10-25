import type { Metadata } from 'next';
import { connectName } from '@/lib/brand';
import { getBrand } from '@/lib/brand-server';

export function generateMetadata(): Metadata {
  const brand = getBrand();
  return {
    title: 'تطبيق Connect — رسائل ومكالمات',
    description: `ثبّت تطبيق ${connectName(brand)} على أندرويد والآيفون وويندوز: رسائل ومكالمات صوتية واضحة مع فريق الوكالة ومرشدك.`,
    manifest: '/connect.webmanifest',
    openGraph: {
      title: `${connectName(brand)} — تطبيق الرسائل والمكالمات`,
      description: 'رسائل ومكالمات صوتية واضحة مع فريق الوكالة ومرشدك. ثبّته من موقعنا مجاناً.',
      url: '/app',
      images: [{ url: brand.og_image_url, width: 1200, height: 630 }],
    },
  };
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}

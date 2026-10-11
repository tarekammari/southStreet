import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'تطبيق Connect — رسائل ومكالمات',
  description: 'ثبّت تطبيق South Street Connect على أندرويد والآيفون وويندوز: رسائل ومكالمات صوتية واضحة مع فريق الوكالة ومرشدك.',
  manifest: '/connect.webmanifest',
  openGraph: {
    title: 'South Street Connect — تطبيق الرسائل والمكالمات',
    description: 'رسائل ومكالمات صوتية واضحة مع فريق الوكالة ومرشدك. ثبّته من موقعنا مجاناً.',
    url: '/app',
    images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630 }],
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'South Street Connect',
  description: 'رسائل ومكالمات صوتية بين المعتمرين وفريق وكالة ساوث ستريت.',
  manifest: '/connect.webmanifest',
  appleWebApp: { capable: true, title: 'SS Connect', statusBarStyle: 'default' },
  icons: { apple: '/icons/connect-180.png', icon: '/icons/connect-192.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#047857',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function ConnectLayout({ children }: { children: React.ReactNode }) {
  return children;
}

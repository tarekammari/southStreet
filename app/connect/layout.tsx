import type { Metadata, Viewport } from 'next';
import { agencyLabel, connectName, shortConnectName } from '@/lib/brand';
import { getBrand } from '@/lib/brand-server';

export function generateMetadata(): Metadata {
  const brand = getBrand();
  return {
    title: connectName(brand),
    description: `رسائل ومكالمات صوتية بين المعتمرين وفريق ${agencyLabel(brand)}.`,
    manifest: '/connect.webmanifest',
    appleWebApp: { capable: true, title: shortConnectName(brand), statusBarStyle: 'default' },
    icons: { apple: '/icons/connect-180.png', icon: '/icons/connect-192.png' },
    robots: { index: false, follow: false },
  };
}

export function generateViewport(): Viewport {
  return { ...viewport, themeColor: getBrand().primary_color };
}

const viewport: Viewport = {
  themeColor: '#047857',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function ConnectLayout({ children }: { children: React.ReactNode }) {
  return children;
}

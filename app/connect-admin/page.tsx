import type { Metadata, Viewport } from 'next';
import ConnectAdmin from '@/components/connect/admin/ConnectAdmin';
import { shortConnectName } from '@/lib/brand';
import { getBrand } from '@/lib/brand-server';

export function generateMetadata(): Metadata {
  const app = shortConnectName(getBrand());
  return {
    title: `لوحة ${app}`,
    description: `غرفة التحكم في ${app} — للمدير العام فقط.`,
    robots: { index: false, follow: false },
  };
}

// Usable on the phone too: the page is as wide as the screen.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#047857' };

export default function ConnectAdminPage() {
  return <ConnectAdmin />;
}

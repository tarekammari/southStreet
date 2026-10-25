import type { Metadata, Viewport } from 'next';
import ConnectAdmin from '@/components/connect/admin/ConnectAdmin';

export const metadata: Metadata = {
  title: 'لوحة SS Connect',
  description: 'غرفة التحكم في SS Connect — للمدير العام فقط.',
  robots: { index: false, follow: false },
};

// Usable on the phone too: the page is as wide as the screen.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#047857' };

export default function ConnectAdminPage() {
  return <ConnectAdmin />;
}

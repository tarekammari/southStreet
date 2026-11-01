import type { Metadata } from 'next';

/** Super Admin's phone: approve a new device's QR sign-in. Not for search engines. */
export const metadata: Metadata = {
  title: 'ربط جهاز',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function LinkDeviceLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ربط جهاز كمبيوتر',
  description: 'أكّد الدخول إلى حسابك على الكمبيوتر بمسح رمز QR من هاتفك.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

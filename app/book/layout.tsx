import { brandMetadata } from '@/lib/brand-meta';

export const generateMetadata = brandMetadata(() => ({
  title: 'احجز رحلتك',
  description: 'أرسلوا طلب حجز العمرة في دقائق، وتتابع الوكالة معكم الوثائق والتأشيرة والدفع.',
  path: '/book',
}));

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

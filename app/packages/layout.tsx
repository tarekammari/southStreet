import { brandMetadata } from '@/lib/brand-meta';

export const generateMetadata = brandMetadata(() => ({
  title: 'البرامج والرحلات',
  shareTitle: 'برامج العمرة والحج',
  description: 'برامج العمرة والحج القادمة: التواريخ، الفنادق، الطيران والأسعار — احجزوا مقعدكم أو استفسروا عبر واتساب.',
  path: '/packages',
}));

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

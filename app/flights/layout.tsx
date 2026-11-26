import { brandMetadata } from '@/lib/brand-meta';

export const generateMetadata = brandMetadata(() => ({
  title: 'حجز تذاكر الطيران — قريباً',
  description: 'حجز تذاكر الطيران إلى كل الوجهات حول العالم مع الخطوط الجوية الجزائرية مباشرة من الموقع، قريباً.',
  path: '/flights',
}));

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

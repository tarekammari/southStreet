import { brandMetadata } from '@/lib/brand-meta';

export const generateMetadata = brandMetadata(() => ({
  title: 'الفنادق',
  description: 'فنادق شريكة قرب الحرمين وفي وجهات رحلاتنا: تركيا، ماليزيا، مصر، تونس، إسبانيا ولندن — مع الخدمات والصور.',
  path: '/hotels',
}));

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'الفنادق',
  description: 'فنادق شريكة قرب الحرمين وفي وجهات رحلاتنا: تركيا، ماليزيا، مصر، تونس، إسبانيا ولندن — مع الخدمات والصور.',
  openGraph: { title: 'الفنادق | ساوث ستريت', description: 'فنادق شريكة قرب الحرمين وفي وجهات رحلاتنا: تركيا، ماليزيا، مصر، تونس، إسبانيا ولندن — مع الخدمات والصور.', url: '/hotels', images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'الفنادق | ساوث ستريت', description: 'فنادق شريكة قرب الحرمين وفي وجهات رحلاتنا: تركيا، ماليزيا، مصر، تونس، إسبانيا ولندن — مع الخدمات والصور.', images: ['/og/south-street-og.jpg'] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'فنادق مكة والمدينة',
  description: 'فنادق شريكة قريبة من الحرم المكي والمسجد النبوي، مع المسافة والخدمات والصور.',
  openGraph: { title: 'فنادق مكة والمدينة | ساوث ستريت', description: 'فنادق شريكة قريبة من الحرم المكي والمسجد النبوي، مع المسافة والخدمات والصور.', url: '/hotels', images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'فنادق مكة والمدينة | ساوث ستريت', description: 'فنادق شريكة قريبة من الحرم المكي والمسجد النبوي، مع المسافة والخدمات والصور.', images: ['/og/south-street-og.jpg'] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

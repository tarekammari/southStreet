import type { Metadata } from 'next';

const description = 'رحلات سياحية منظّمة إلى تركيا، ماليزيا، مصر، تونس، إسبانيا ولندن: برنامج يوماً بيوم، فنادق مختارة، والوكالة تتكفّل بالتأشيرة.';

export const metadata: Metadata = {
  title: 'رحلات سياحية',
  description,
  openGraph: { title: 'رحلات سياحية | ساوث ستريت', description, url: '/trips', images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'رحلات سياحية | ساوث ستريت', description, images: ['/og/south-street-og.jpg'] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

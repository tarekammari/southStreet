import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'روابطنا',
  description: 'كل روابط وكالة ساوث ستريت في مكان واحد: واتساب، برامج العمرة، الحجز، ودليل العمرة.',
  openGraph: { title: 'ساوث ستريت — واتساب والبرامج والحجز', description: 'راسلونا على واتساب أو تصفحوا برامج العمرة واحجزوا مقعدكم.', url: '/links', images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', images: ['/og/south-street-og.jpg'] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

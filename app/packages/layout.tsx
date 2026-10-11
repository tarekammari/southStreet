import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'برامج العمرة والحج',
  description: 'برامج العمرة والحج القادمة: التواريخ، الفنادق، الطيران والأسعار — احجزوا مقعدكم أو استفسروا عبر واتساب.',
  openGraph: { title: 'برامج العمرة والحج | ساوث ستريت', description: 'برامج العمرة والحج القادمة: التواريخ، الفنادق، الطيران والأسعار — احجزوا مقعدكم أو استفسروا عبر واتساب.', url: '/packages', images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'برامج العمرة والحج | ساوث ستريت', description: 'برامج العمرة والحج القادمة: التواريخ، الفنادق، الطيران والأسعار — احجزوا مقعدكم أو استفسروا عبر واتساب.', images: ['/og/south-street-og.jpg'] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

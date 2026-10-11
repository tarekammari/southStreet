import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'عن الوكالة',
  description: 'تعرّفوا على وكالة ساوث ستريت للعمرة والحج: قصتنا، فريقنا ومرشدونا، وكيف نرافقكم من الحجز حتى العودة.',
  openGraph: { title: 'عن الوكالة | ساوث ستريت', description: 'تعرّفوا على وكالة ساوث ستريت للعمرة والحج: قصتنا، فريقنا ومرشدونا، وكيف نرافقكم من الحجز حتى العودة.', url: '/about', images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'عن الوكالة | ساوث ستريت', description: 'تعرّفوا على وكالة ساوث ستريت للعمرة والحج: قصتنا، فريقنا ومرشدونا، وكيف نرافقكم من الحجز حتى العودة.', images: ['/og/south-street-og.jpg'] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

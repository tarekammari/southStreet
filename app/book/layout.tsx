import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'احجز رحلتك',
  description: 'أرسلوا طلب حجز العمرة في دقائق، وتتابع الوكالة معكم الوثائق والتأشيرة والدفع.',
  openGraph: { title: 'احجز رحلتك | ساوث ستريت', description: 'أرسلوا طلب حجز العمرة في دقائق، وتتابع الوكالة معكم الوثائق والتأشيرة والدفع.', url: '/book', images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'احجز رحلتك | ساوث ستريت', description: 'أرسلوا طلب حجز العمرة في دقائق، وتتابع الوكالة معكم الوثائق والتأشيرة والدفع.', images: ['/og/south-street-og.jpg'] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

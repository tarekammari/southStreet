import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'دليل العمرة خطوة بخطوة',
  description: 'دليل مبسّط للعمرة: الإحرام، الطواف، السعي، الحلق والتقصير، مع الأدعية وقائمة تجهيز تفاعلية وعدّاد للأشواط.',
  openGraph: { title: 'دليل العمرة خطوة بخطوة | ساوث ستريت', description: 'دليل مبسّط للعمرة: الإحرام، الطواف، السعي، الحلق والتقصير، مع الأدعية وقائمة تجهيز تفاعلية وعدّاد للأشواط.', url: '/guide', images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'دليل العمرة خطوة بخطوة | ساوث ستريت', description: 'دليل مبسّط للعمرة: الإحرام، الطواف، السعي، الحلق والتقصير، مع الأدعية وقائمة تجهيز تفاعلية وعدّاد للأشواط.', images: ['/og/south-street-og.jpg'] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

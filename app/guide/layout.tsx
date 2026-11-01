import { brandMetadata } from '@/lib/brand-meta';

export const generateMetadata = brandMetadata(() => ({
  title: 'دليل العمرة خطوة بخطوة',
  description: 'دليل مبسّط للعمرة: الإحرام، الطواف، السعي، الحلق والتقصير، مع الأدعية وقائمة تجهيز تفاعلية وعدّاد للأشواط.',
  path: '/guide',
}));

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

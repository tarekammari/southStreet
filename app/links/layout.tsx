import { agencyLabel } from '@/lib/brand';
import { brandPageMeta } from '@/lib/brand-meta';
import { getBrand } from '@/lib/brand-server';

export function generateMetadata() {
  const brand = getBrand();
  const meta = brandPageMeta(brand, {
    title: 'روابطنا',
    description: `كل روابط ${agencyLabel(brand)} في مكان واحد: واتساب، برامج العمرة، الحجز، ودليل العمرة.`,
    path: '/links',
  });
  const share = { title: `${brand.short_name} — واتساب والبرامج والحجز`, description: 'راسلونا على واتساب أو تصفحوا برامج العمرة واحجزوا مقعدكم.' };
  return { ...meta, openGraph: { ...meta.openGraph, ...share }, twitter: { card: 'summary_large_image' as const, images: [brand.og_image_url] } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

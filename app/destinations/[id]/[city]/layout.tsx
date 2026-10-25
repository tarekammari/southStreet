import type { Metadata } from 'next';
import { destinationOf } from '@/lib/tour';
import { cityFromSlug, cityInfo } from '@/lib/destination-cities';
import { brandPageMeta } from '@/lib/brand-meta';
import { getBrand } from '@/lib/brand-server';

export async function generateMetadata({ params }: { params: Promise<{ id: string; city: string }> }): Promise<Metadata> {
  const { id, city: slug } = await params;
  const dest = destinationOf(String(id).toUpperCase());
  const city = dest ? cityFromSlug(dest.cities, slug) : '';
  if (!dest || !city) return { title: 'الوجهات' };
  const info = cityInfo(city);
  const brand = getBrand();
  return brandPageMeta(brand, {
    title: `فنادق ${city} — ${dest.label}`,
    description: `${info.blurb ? `${info.blurb} ` : ''}احجز فندقك في ${city} مع ${brand.short_name}: صور الغرف والمطعم والمرافق والأسعار بالدينار.`,
    path: `/destinations/${dest.id}/${info.slug}`,
    absolute: true,
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

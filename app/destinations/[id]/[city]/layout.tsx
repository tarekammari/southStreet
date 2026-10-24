import type { Metadata } from 'next';
import { destinationOf } from '@/lib/tour';
import { cityFromSlug, cityInfo } from '@/lib/destination-cities';

export async function generateMetadata({ params }: { params: Promise<{ id: string; city: string }> }): Promise<Metadata> {
  const { id, city: slug } = await params;
  const dest = destinationOf(String(id).toUpperCase());
  const city = dest ? cityFromSlug(dest.cities, slug) : '';
  if (!dest || !city) return { title: 'الوجهات' };
  const info = cityInfo(city);
  const title = `فنادق ${city} — ${dest.label}`;
  const description = `${info.blurb ? `${info.blurb} ` : ''}احجز فندقك في ${city} مع ساوث ستريت: صور الغرف والمطعم والمرافق والأسعار بالدينار.`;
  const url = `/destinations/${dest.id}/${info.slug}`;
  return {
    title: { absolute: `${title} | ساوث ستريت` },
    description,
    openGraph: { title: `${title} | ساوث ستريت`, description, url, images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: `${title} | ساوث ستريت`, description, images: ['/og/south-street-og.jpg'] },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

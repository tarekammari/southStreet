import type { Metadata } from 'next';
import { destinationOf } from '@/lib/tour';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const dest = destinationOf(String(id).toUpperCase());
  if (!dest) return { title: 'الوجهات' };
  const title = `${dest.label} — رحلات وفنادق`;
  const description = `رحلات الوكالة المنظّمة إلى ${dest.label}، مدنها (${dest.cities.slice(0, 4).join('، ')}) وفنادقها مع الغرف والأسعار بالدينار.`;
  return {
    title,
    description,
    openGraph: { title: `${title} | ساوث ستريت`, description, url: `/destinations/${dest.id}`, images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: `${title} | ساوث ستريت`, description, images: ['/og/south-street-og.jpg'] },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

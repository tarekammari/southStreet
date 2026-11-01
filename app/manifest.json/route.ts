import { getBrand } from '@/lib/brand-server';

export const dynamic = 'force-dynamic';

/** Install manifest of the site, named after this agency (one build serves every agency). */
export function GET() {
  const brand = getBrand();
  const icon = brand.mark_url || brand.logo_url;
  const manifest = {
    name: `${brand.agency_name} | ${brand.name_latin}`,
    short_name: brand.short_name || brand.name_latin,
    description: brand.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#0F172A',
    theme_color: brand.primary_color || '#064E3B',
    orientation: 'portrait',
    lang: 'ar',
    dir: 'rtl',
    icons: icon ? [{ src: icon, sizes: '512x512', purpose: 'any' }] : [],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

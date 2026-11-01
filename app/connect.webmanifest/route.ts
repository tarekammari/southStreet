import { getBrand } from '@/lib/brand-server';
import { connectName, shortConnectName } from '@/lib/brand';

export const dynamic = 'force-dynamic';

/** Install manifest of the Connect web app, named after this agency (not a static file: one build serves every agency). */
export function GET() {
  const brand = getBrand();
  const manifest = {
    id: '/connect',
    name: connectName(brand),
    short_name: shortConnectName(brand),
    description: `رسائل ومكالمات صوتية بين المعتمرين وفريق ${brand.agency_name}`,
    start_url: '/connect?source=app',
    scope: '/connect',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: brand.primary_color || '#047857',
    lang: 'ar',
    dir: 'rtl',
    categories: ['communication', 'travel'],
    icons: [
      { src: '/icons/connect-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/connect-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/connect-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

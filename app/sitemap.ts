import type { MetadataRoute } from 'next';

const SITE_URL =
  process.env.APP_ORIGIN?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/** Public pages for search engines (account and admin pages stay out). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { path: '/', priority: 1, freq: 'daily' as const },
    { path: '/packages', priority: 0.9, freq: 'daily' as const },
    { path: '/trips', priority: 0.9, freq: 'daily' as const },
    { path: '/book', priority: 0.8, freq: 'weekly' as const },
    { path: '/hotels', priority: 0.7, freq: 'weekly' as const },
    { path: '/guide', priority: 0.7, freq: 'monthly' as const },
    { path: '/about', priority: 0.6, freq: 'monthly' as const },
    { path: '/app', priority: 0.5, freq: 'monthly' as const },
    { path: '/links', priority: 0.4, freq: 'monthly' as const },
  ].map((p) => ({ url: `${SITE_URL}${p.path}`, lastModified: now, changeFrequency: p.freq, priority: p.priority }));
}

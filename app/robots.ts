import type { MetadataRoute } from 'next';

const SITE_URL =
  process.env.APP_ORIGIN?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/portal', '/my-bookings', '/enroll', '/book/print'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

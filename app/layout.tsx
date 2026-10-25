import type { Metadata, Viewport } from 'next';
// Fonts are self-hosted (public/fonts) so the build never depends on Google Fonts.
import './fonts.css';
import './globals.css';
import './programs.css';
import './hotels-booking.css';
import './destinations.css';
import './bookings.css';
import './home.css';
import './security.css';
import './sakhr.css';
import './social.css';
import '../components/dashboards/accountant-theme.css';
import SessionGuard from '@/components/SessionGuard';
import IntroSplash from '@/components/IntroSplash';
import { INTRO_BOOT_SCRIPT } from '@/lib/intro-boot';
import { BrandProvider } from '@/components/social/useAgencyInfo';
import { agencyLabel, brandCssVars } from '@/lib/brand';
import { getBrand } from '@/lib/brand-server';
import './motion.css';

/** Public address of the site: link previews (Facebook, WhatsApp…) need absolute URLs. */
const SITE_URL =
  process.env.APP_ORIGIN?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * Titles, link previews, favicon and colour come from the agency's brand
 * («هوية الوكالة», lib/brand.ts), read on every request so an edit shows at once.
 */
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const brand = getBrand();
  const title = brand.site_title || `${brand.short_name} | ${brand.name_latin.toUpperCase()} - وكالة الرحلات وعروض العمرة والحج`;
  const description = `${agencyLabel(brand)} للعمرة والحج من ${brand.country || 'الجزائر'}: برامج وأسعار واضحة، فنادق قريبة من الحرم، مرشدون يرافقونكم، وحجز سهل عبر الموقع أو واتساب.`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${brand.short_name}` },
    description,
    keywords: ['عمرة', 'حج', brand.short_name, brand.name_latin, 'رحلات مكة', 'فنادق مكة', 'الجزائر عمرة', 'عمرة 2026', 'وكالة سياحة الجزائر'],
    applicationName: brand.name_latin,
    ...(brand.favicon_url ? { icons: { icon: brand.favicon_url, apple: brand.favicon_url } } : {}),
    openGraph: {
      type: 'website',
      locale: 'ar_DZ',
      siteName: brand.agency_name,
      title,
      description,
      url: '/',
      images: [{ url: brand.og_image_url, width: 1200, height: 630, alt: `${brand.short_name} — رحلات العمرة والحج` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [brand.og_image_url],
    },
    robots: { index: true, follow: true },
    formatDetection: { telephone: true },
  };
}

export function generateViewport(): Viewport {
  return { themeColor: getBrand().primary_color };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const brand = getBrand();
  const brandCss = brandCssVars(brand);
  return (
    <html
      lang="ar"
      dir="rtl"
    >
      <head>
        {/* Brand colour first: the intro boot script below adds its own <style> after itself. */}
        {brandCss ? <style dangerouslySetInnerHTML={{ __html: brandCss }} /> : null}
        {/* Decides before first paint whether the intro splash plays (see lib/intro.ts). */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT_SCRIPT }} />
        {/* Programs, hotels, team, texts: start downloading with the page, not after the scripts run. */}
        <link rel="preload" href="/api/public/catalog" as="fetch" crossOrigin="anonymous" />
      </head>
      <body className="bg-slate-app text-slate-darkBg antialiased flex flex-col min-h-screen">
        <BrandProvider brand={brand}>
          <IntroSplash />
          <SessionGuard />
          {children}
        </BrandProvider>
      </body>
    </html>
  );
}

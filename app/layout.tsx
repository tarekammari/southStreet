import type { Metadata, Viewport } from 'next';
// Fonts are self-hosted (public/fonts) so the build never depends on Google Fonts.
import './fonts.css';
import './globals.css';
import './programs.css';
import './hotels-booking.css';
import './destinations.css';
import './home.css';
import './security.css';
import './sakhr.css';
import './social.css';
import '../components/dashboards/accountant-theme.css';
import SessionGuard from '@/components/SessionGuard';
import IntroSplash from '@/components/IntroSplash';
import { INTRO_BOOT_SCRIPT } from '@/lib/intro-boot';
import './motion.css';

/** Public address of the site: link previews (Facebook, WhatsApp…) need absolute URLs. */
const SITE_URL =
  process.env.APP_ORIGIN?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

const SITE_TITLE = 'سوث ستريت | SOUTH STREET - وكالة الرحلات وعروض العمرة والحج';
const SITE_DESCRIPTION = 'وكالة ساوث ستريت للعمرة والحج من الجزائر: برامج وأسعار واضحة، فنادق قريبة من الحرم، مرشدون يرافقونكم، وحجز سهل عبر الموقع أو واتساب.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: '%s | ساوث ستريت' },
  description: SITE_DESCRIPTION,
  keywords: ['عمرة', 'حج', 'سوث ستريت', 'ساوث ستريت', 'رحلات مكة', 'فنادق مكة', 'الجزائر عمرة', 'عمرة 2026', 'وكالة سياحة الجزائر'],
  applicationName: 'South Street',
  openGraph: {
    type: 'website',
    locale: 'ar_DZ',
    siteName: 'ساوث ستريت للأسفار والعمرة',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    images: [{ url: '/og/south-street-og.jpg', width: 1200, height: 630, alt: 'ساوث ستريت — رحلات العمرة والحج' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og/south-street-og.jpg'],
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: true },
};

export const viewport: Viewport = {
  themeColor: '#047857',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
    >
      <head>
        {/* Decides before first paint whether the intro splash plays (see lib/intro.ts). */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT_SCRIPT }} />
        {/* Programs, hotels, team, texts: start downloading with the page, not after the scripts run. */}
        <link rel="preload" href="/api/public/catalog" as="fetch" crossOrigin="anonymous" />
      </head>
      <body className="bg-slate-app text-slate-darkBg antialiased flex flex-col min-h-screen">
        <IntroSplash />
        <SessionGuard />
        {children}
      </body>
    </html>
  );
}

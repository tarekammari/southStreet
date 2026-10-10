import type { Metadata, Viewport } from 'next';
// Fonts are self-hosted (public/fonts) so the build never depends on Google Fonts.
import './fonts.css';
import './globals.css';
import './programs.css';
import './home.css';
import './security.css';
import './sakhr.css';
import '../components/dashboards/accountant-theme.css';
import SessionGuard from '@/components/SessionGuard';
import IntroSplash from '@/components/IntroSplash';
import { INTRO_BOOT_SCRIPT } from '@/lib/intro-boot';
import './motion.css';

export const metadata: Metadata = {
  title: 'سوث ستريت | SOUTH STREET - وكالة الرحلات وعروض العمرة والحج',
  description: 'وكالة سوث ستريت للرحلات والعمرة والحج - حجز فاخر، بطاقات بريدية للبقاع المقدسة، وتواصل مشفر E2E حقيقي',
  keywords: ['عمرة', 'حج', 'سوث ستريت', 'رحلات مكة', 'فنادق مكة', 'الجزائر عمرة'],
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
      </head>
      <body className="bg-slate-app text-slate-darkBg antialiased flex flex-col min-h-screen">
        <IntroSplash />
        <SessionGuard />
        {children}
      </body>
    </html>
  );
}

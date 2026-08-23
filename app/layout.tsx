import type { Metadata, Viewport } from 'next';
import { Tajawal, Amiri, Cairo, Aref_Ruqaa } from 'next/font/google';
import './globals.css';

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '800', '900'],
  variable: '--font-tajawal',
});

const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-amiri',
});

const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-cairo',
});

const arefRuqaa = Aref_Ruqaa({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-ruqaa',
});

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
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${amiri.variable} ${cairo.variable} ${arefRuqaa.variable}`}>
      <body className="bg-slate-app text-slate-darkBg antialiased flex flex-col min-h-screen">
        {children}
      </body>
    </html>
  );
}

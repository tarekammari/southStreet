import { agencyLabel } from '@/lib/brand';
import { brandMetadata } from '@/lib/brand-meta';

export const generateMetadata = brandMetadata((brand) => ({
  title: 'عن الوكالة',
  description: `تعرّفوا على ${agencyLabel(brand)} للعمرة والحج: قصتنا، فريقنا ومرشدونا، وكيف نرافقكم من الحجز حتى العودة.`,
  path: '/about',
}));

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

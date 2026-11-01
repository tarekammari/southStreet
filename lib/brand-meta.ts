import type { Metadata } from 'next';
import { brandTitle, type Brand } from './brand';
import { getBrand } from './brand-server';

type PageMeta = {
  title: string;
  description: string;
  path: string;
  /** Title of link previews when it differs from the tab title. */
  shareTitle?: string;
  /** Tab title used as it is (no «| agency» suffix from the root layout). */
  absolute?: boolean;
  extra?: Metadata;
};

/** Title, description and link preview (Open Graph / X) of a page, in the agency's name. */
export function brandPageMeta(brand: Brand, page: PageMeta): Metadata {
  const shareTitle = brandTitle(brand, page.shareTitle || page.title);
  const images = [{ url: brand.og_image_url, width: 1200, height: 630 }];
  return {
    title: page.absolute ? { absolute: shareTitle } : page.title,
    description: page.description,
    openGraph: { title: shareTitle, description: page.description, url: page.path, images },
    twitter: { card: 'summary_large_image', title: shareTitle, description: page.description, images: [brand.og_image_url] },
    ...page.extra,
  };
}

/** `export const generateMetadata = brandMetadata((brand) => ({ … }))` in a layout. */
export function brandMetadata(build: (brand: Brand) => PageMeta) {
  return function generateMetadata(): Metadata {
    const brand = getBrand();
    return brandPageMeta(brand, build(brand));
  };
}

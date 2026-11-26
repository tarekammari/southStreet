import Link from 'next/link';

/**
 * Three small 3D scenes under the agency hero, drawn in CSS and SVG only
 * (no images, no 3D library): the Kaaba (a turning cube with the gold band
 * and door), an aeroplane flying around a dotted route, and a travel
 * suitcase turning. Each card links to the matching page and tilts on hover.
 * Styles: components/about/agency-hero.css (.hs-*).
 */

function Cube({ kind }: { kind: 'kaaba' | 'case' }) {
  return (
    <div className="hs-tilt">
    <div className={`hs-cube is-${kind}`}>
      <span className="hs-f is-front" />
      <span className="hs-f is-back" />
      <span className="hs-f is-right" />
      <span className="hs-f is-left" />
      <span className="hs-f is-top" />
      <span className="hs-f is-bottom" />
    </div>
    </div>
  );
}

function Plane() {
  return (
    <div className="hs-flight">
      {/* Dotted route the plane follows (seen in perspective) */}
      <svg className="hs-route" viewBox="0 0 200 200" aria-hidden focusable="false">
        <circle cx="100" cy="100" r="78" />
      </svg>
      <div className="hs-orbit">
        <svg className="hs-plane" viewBox="0 0 64 64" aria-hidden focusable="false">
          <path d="M32 3c2.4 0 4 2.6 4 6.2V24l22 13v5l-22-6.6V50l7 5v4l-11-3.2L21 59v-4l7-5V35.4L6 42v-5l22-13V9.2C28 5.6 29.6 3 32 3z" />
        </svg>
      </div>
    </div>
  );
}

const CARDS = [
  { key: 'kaaba', href: '/packages', title: 'العمرة والحج', sub: 'برامج إلى بيت الله الحرام', scene: <Cube kind="kaaba" /> },
  { key: 'plane', href: '/book', title: 'رحلات جوية', sub: 'حجز وتنظيم السفر', scene: <Plane /> },
  { key: 'trip', href: '/packages?kind=tourism', title: 'رحلات سياحية', sub: 'وجهات حول العالم', scene: <Cube kind="case" /> },
] as const;

export default function HeroShowcase() {
  return (
    <div className="hs-row">
      {CARDS.map((c, i) => (
        <Link key={c.key} href={c.href} className={`hs-card is-${c.key} hs-in`} style={{ animationDelay: `${300 + i * 120}ms` }}>
          <span className="hs-stage" aria-hidden>
            {c.scene}
            <i className="hs-floor" />
          </span>
          <b>{c.title}</b>
          <small>{c.sub}</small>
        </Link>
      ))}
    </div>
  );
}

/**
 * South Street brand lockup: the three-stroke mark (vector copy of
 * /images/south_street_logo_*.png) + wordmark. Inline SVG stays sharp at any
 * size and lets the strokes animate in on first paint.
 */
export default function BrandLogo({
  tone = 'dark',
  compact = false,
  animate = true,
}: {
  tone?: 'dark' | 'light';
  compact?: boolean;
  animate?: boolean;
}) {
  return (
    <span className={`brand${tone === 'light' ? ' is-light' : ''}${compact ? ' is-compact' : ''}${animate ? ' is-animated' : ''}`}>
      <svg className="brand-mark" viewBox="0 0 700 410" aria-hidden focusable="false">
        <path className="brand-s3" d="M410 250 C 480 270 560 330 600 408 L 700 367 C 660 320 620 285 585 252 Z" />
        <path className="brand-s2" d="M0 154 C 120 146 260 146 330 152 L 696 154 L 696 252 L 0 252 Z" />
        <path className="brand-s1" d="M0 154 C 160 168 300 166 380 148 C 450 125 515 80 550 0 L 648 40 C 590 112 505 190 405 230 C 305 262 150 262 0 252 Z" />
      </svg>
      {!compact ? (
        <span className="brand-text">
          <span className="brand-name" lang="en">South Street</span>
          <span className="brand-tag">عمرة · حج · رحلات</span>
        </span>
      ) : null}
      <span className="sr-only">ساوث ستريت — الصفحة الرئيسية</span>
    </span>
  );
}

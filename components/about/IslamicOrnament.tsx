/**
 * Islamic geometric ornaments for the About hero, drawn in SVG (no image
 * files, a few hundred bytes):
 *  - IslamicPattern: a repeating eight-point-star lattice in gold and green
 *    that drifts slowly.
 *  - IslamicRosette: a sixteen-point rosette whose lines draw in once, then
 *    turn slowly behind the logo.
 * Both are decorative (aria-hidden); colours come from CSS classes
 * (.gi-gold, .gi-green, .gi-fill) so the page can theme them. They only
 * move with transform / stroke-dashoffset, and reduced motion stops them.
 */

const STAR = 'M40 8 L49 31 L72 40 L49 49 L40 72 L31 49 L8 40 L31 31 Z';

export function IslamicPattern({ className = '' }: { className?: string }) {
  return (
    <svg className={className} aria-hidden focusable="false" width="100%" height="100%">
      <defs>
        <pattern id="gc-girih" width="80" height="80" patternUnits="userSpaceOnUse">
          <g fill="none" strokeWidth="1.1">
            {/* Eight-point star from two squares (green), the star outline (gold) */}
            <rect className="gi-green" x="22" y="22" width="36" height="36" />
            <rect className="gi-green" x="22" y="22" width="36" height="36" transform="rotate(45 40 40)" />
            <path className="gi-gold gi-fill" d={STAR} />
            <circle className="gi-green gi-dot" cx="40" cy="40" r="5" />
            {/* Lines tying each star to its neighbours (gold) */}
            <path className="gi-gold" d="M0 0 L22 22 M80 0 L58 22 M0 80 L22 58 M80 80 L58 58 M40 0 V14.5 M40 80 V65.5 M0 40 H14.5 M80 40 H65.5" />
            {/* Small diamonds where four tiles meet (green) */}
            <path className="gi-green gi-dot" d="M0 -6 L6 0 L0 6 L-6 0 Z M80 -6 L86 0 L80 6 L74 0 Z M0 74 L6 80 L0 86 L-6 80 Z M80 74 L86 80 L80 86 L74 80 Z" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#gc-girih)" />
    </svg>
  );
}

export function IslamicRosette({ className = '', inner = false }: { className?: string; inner?: boolean }) {
  const turns = [0, 22.5, 45, 67.5];
  const big = inner ? 52 : 66;
  const small = inner ? 30 : 38;
  return (
    <svg className={className} viewBox="-100 -100 200 200" aria-hidden focusable="false">
      <g fill="none" strokeWidth={inner ? 0.9 : 0.7} strokeLinejoin="round">
        {inner ? null : <circle className="gi-gold gc-draw" r="97" pathLength={1} />}
        {inner ? null : <circle className="gi-gold gc-draw" r="91" pathLength={1} style={{ animationDelay: '.15s' }} />}
        {turns.map((t, i) => (
          <rect
            key={t}
            className={`${i % 2 ? 'gi-gold' : 'gi-green'} gc-draw`}
            x={-big} y={-big} width={big * 2} height={big * 2}
            transform={`rotate(${t})`}
            pathLength={1}
            style={{ animationDelay: `${0.25 + i * 0.12}s` }}
          />
        ))}
        {turns.map((t, i) => (
          <rect
            key={`in-${t}`}
            className={`${i % 2 ? 'gi-green' : 'gi-gold'} gc-draw`}
            x={-small} y={-small} width={small * 2} height={small * 2}
            transform={`rotate(${t})`}
            pathLength={1}
            style={{ animationDelay: `${0.7 + i * 0.1}s` }}
          />
        ))}
        <circle className="gi-green gc-draw" r={inner ? 42 : 54} pathLength={1} style={{ animationDelay: '1s' }} />
      </g>
    </svg>
  );
}

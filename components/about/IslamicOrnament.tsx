/**
 * Islamic geometric ornaments for the About hero, drawn in SVG (no image
 * files, a few hundred bytes):
 *  - IslamicPattern: a repeating eight-point-star lattice that drifts slowly.
 *  - IslamicRosette: a sixteen-point rosette whose lines draw in once, then
 *    turn very slowly behind the logo.
 * Both are decorative (aria-hidden) and only move with transform /
 * stroke-dashoffset, so they stay cheap; reduced motion stops them (CSS).
 */

const STAR_TILE = 'M40 8 L49 31 L72 40 L49 49 L40 72 L31 49 L8 40 L31 31 Z';

export function IslamicPattern({ className = '' }: { className?: string }) {
  return (
    <svg className={className} aria-hidden focusable="false" width="100%" height="100%">
      <defs>
        <pattern id="gc-girih" width="80" height="80" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            {/* Eight-point star: two squares, one turned 45° */}
            <rect x="22" y="22" width="36" height="36" />
            <rect x="22" y="22" width="36" height="36" transform="rotate(45 40 40)" />
            <path d={STAR_TILE} />
            <circle cx="40" cy="40" r="6" />
            {/* Lines that tie each star to its neighbours */}
            <path d="M0 0 L22 22 M80 0 L58 22 M0 80 L22 58 M80 80 L58 58 M40 0 V14.5 M40 80 V65.5 M0 40 H14.5 M80 40 H65.5" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#gc-girih)" />
    </svg>
  );
}

export function IslamicRosette({ className = '' }: { className?: string }) {
  const turns = [0, 22.5, 45, 67.5];
  return (
    <svg className={className} viewBox="-100 -100 200 200" aria-hidden focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth=".6" strokeLinejoin="round">
        <circle r="97" pathLength={1} className="gc-draw" />
        <circle r="91" pathLength={1} className="gc-draw" style={{ animationDelay: '.15s' }} />
        {turns.map((t, i) => (
          <rect
            key={t}
            x="-66" y="-66" width="132" height="132"
            transform={`rotate(${t})`}
            pathLength={1}
            className="gc-draw"
            style={{ animationDelay: `${0.25 + i * 0.12}s` }}
          />
        ))}
        {turns.map((t, i) => (
          <rect
            key={`in-${t}`}
            x="-38" y="-38" width="76" height="76"
            transform={`rotate(${t})`}
            pathLength={1}
            className="gc-draw"
            style={{ animationDelay: `${0.7 + i * 0.1}s` }}
          />
        ))}
        <circle r="54" pathLength={1} className="gc-draw" style={{ animationDelay: '1s' }} />
      </g>
    </svg>
  );
}

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

/** Arabesque (plant scroll) lattice: interlaced vines with leaves and buds. */
export function IslamicArabesque({ className = '' }: { className?: string }) {
  return (
    <svg className={className} aria-hidden focusable="false" width="100%" height="100%">
      <defs>
        <pattern id="gc-arabesque" width="120" height="120" patternUnits="userSpaceOnUse">
          {/* Vines */}
          <g fill="none" className="ga-vine" strokeWidth="1.1" strokeLinecap="round">
            <path d="M0 60 C20 18 40 18 60 60 S100 102 120 60" />
            <path d="M60 0 C102 20 102 40 60 60 S18 100 60 120" />
            <path d="M52 60 a8 8 0 1 1 16 0 a5 5 0 1 1 -10 0" />
            <path d="M14 0 a14 14 0 0 1 -14 14 M106 0 a14 14 0 0 0 14 14 M14 120 a14 14 0 0 0 -14 -14 M106 120 a14 14 0 0 1 14 -14" />
          </g>
          {/* Leaves */}
          <g className="ga-leaf">
            <path d="M28 33 q11 -15 24 -6 q-11 13 -24 6z" />
            <path d="M92 87 q-11 15 -24 6 q11 -13 24 -6z" />
            <path d="M87 28 q15 11 6 24 q-13 -11 -6 -24z" />
            <path d="M33 92 q-15 -11 -6 -24 q13 11 6 24z" />
          </g>
          {/* Buds */}
          <g className="ga-bud">
            <circle cx="60" cy="60" r="2.6" />
            <circle cx="0" cy="60" r="2" />
            <circle cx="120" cy="60" r="2" />
            <circle cx="60" cy="0" r="2" />
            <circle cx="60" cy="120" r="2" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#gc-arabesque)" />
    </svg>
  );
}

/** Kite-shaped petal between two radii, centred on angle `deg`. */
function petal(deg: number, r1: number, r2: number, spread: number): string {
  const pt = (r: number, a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return `${(r * Math.cos(rad)).toFixed(2)} ${(r * Math.sin(rad)).toFixed(2)}`;
  };
  const mid = (r1 + r2) / 2;
  return `M${pt(r1, deg)} L${pt(mid, deg - spread)} L${pt(r2, deg)} L${pt(mid, deg + spread)} Z`;
}

export function IslamicRosette({ className = '', inner = false }: { className?: string; inner?: boolean }) {
  const turns = [0, 22.5, 45, 67.5];
  const big = inner ? 52 : 66;
  const small = inner ? 30 : 38;
  return (
    <svg className={className} viewBox="-100 -100 200 200" aria-hidden focusable="false">
      {/* Coloured petals around the logo (outer rosette only): 16 long and 16 short ones.
          Each cycles green, emerald, gold, teal, in a wave around the ring. */}
      {inner ? null : (
        <g className="gc-petals">
          {Array.from({ length: 32 }, (_, i) => {
            const long = i % 2 === 0;
            const deg = (360 / 32) * i;
            return (
              <path
                key={i}
                className={`gi-petal${long ? '' : ' is-short'}`}
                d={long ? petal(deg, 58, 90, 6) : petal(deg, 62, 78, 4.5)}
                style={{ animationDelay: `${(-(i / 32) * 8).toFixed(2)}s` }}
              />
            );
          })}
        </g>
      )}
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

/** The Talbiyah, written around a circle. */
const TALBIYAH = 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ ، لَا شَرِيكَ لَكَ ،';

/**
 * A ring of calligraphy (the Talbiyah) with a fine dotted circle inside,
 * for the edge of the hero. The CSS turns it slowly.
 */
export function CalligraphyRing({ className = '', pathId = 'gc-ring-path' }: { className?: string; pathId?: string }) {
  return (
    <svg className={className} viewBox="-300 -300 600 600" aria-hidden focusable="false">
      <defs>
        <path id={pathId} d="M0 -232 a232 232 0 1 1 0 464 a232 232 0 1 1 0 -464" />
      </defs>
      <circle className="gc-ring-dots" r="205" />
      <circle className="gc-ring-line" r="294" />
      <text className="gc-ring-text">
        <textPath href={`#${pathId}`} textLength="1450" lengthAdjust="spacing">{TALBIYAH}</textPath>
      </text>
    </svg>
  );
}

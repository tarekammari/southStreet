/**
 * Ringtones of Connect, synthesised (no audio files on the web).
 *
 * Each ringtone is rendered as ONE loop that repeats without a click: a note
 * whose tail runs past the end carries on at the start, steady tones are tuned
 * to a whole number of cycles per loop, and echoes / reverb run round the loop
 * until they settle.
 * No DOM here: the browser plays it (lib/connect/rtc.ts) and Node renders the
 * WAV files the native apps loop (scripts/render-ringtones.ts) from the same code.
 */

export type RingtoneId = 'south-street' | 'orbit' | 'stardust' | 'nebula' | 'forest' | 'chimes' | 'waves';
export type RingtoneGroup = 'classic' | 'space' | 'nature';

export const RINGTONES: { id: RingtoneId; name: string; hint: string; group: RingtoneGroup; seconds: number }[] = [
  { id: 'south-street', name: 'الأصلية', hint: 'ماريمبا وزقزقة — النغمة الأصلية', group: 'classic', seconds: 3.4 },
  { id: 'orbit', name: 'مدار', hint: 'أجراس زجاجية تدور بصداها في الفضاء', group: 'space', seconds: 6.4 },
  { id: 'stardust', name: 'غبار النجوم', hint: 'بريق نجوم فوق نغمة دافئة عميقة', group: 'space', seconds: 6 },
  { id: 'nebula', name: 'سديم', hint: 'سحابة هادئة تتبدّل وجرس حالم', group: 'space', seconds: 8 },
  { id: 'forest', name: 'صباح الغابة', hint: 'عصافير ونسيم وكاليمبا هادئة', group: 'nature', seconds: 6 },
  { id: 'chimes', name: 'أجراس الريح', hint: 'أجراس معدنية تحرّكها نسمة', group: 'nature', seconds: 7 },
  { id: 'waves', name: 'أمواج', hint: 'موج البحر وقيثارة ناعمة', group: 'nature', seconds: 8 },
];

export const RINGTONE_GROUPS: Record<RingtoneGroup, string> = { classic: 'الأصلية', space: 'إلهام الفضاء', nature: 'طبيعة هادئة' };

export const DEFAULT_RINGTONE: RingtoneId = 'south-street';

export const isRingtone = (v: unknown): v is RingtoneId => RINGTONES.some((r) => r.id === v);

export const ringtoneSeconds = (id: RingtoneId) => RINGTONES.find((r) => r.id === id)?.seconds || 4;

/* ---------------- the loop ---------------- */

class Loop {
  readonly n: number;
  readonly len: number;
  readonly buf: Float32Array;

  constructor(readonly rate: number, seconds: number) {
    this.n = Math.round(rate * seconds);
    this.len = this.n / rate;
    this.buf = new Float32Array(this.n);
  }

  /** Nearest frequency with a whole number of cycles per loop (a steady tone then joins up). */
  tune(f: number) {
    return Math.max(1, Math.round(f * this.len)) / this.len;
  }

  /** Adds `count` samples from `at` seconds on, wrapping round the end of the loop. */
  write(at: number, count: number, fn: (t: number) => number) {
    const s0 = Math.round(at * this.rate);
    const n = this.n;
    for (let i = 0; i < Math.min(count, n); i++) this.buf[(((s0 + i) % n) + n) % n] += fn(i / this.rate);
  }
}

/** Quick rise to `peak` in `att` s, then a fall to silence (−60 dB) at `decay` s. */
function env(t: number, peak: number, att: number, decay: number) {
  if (t < att) return peak * (t / att) * (t / att);
  return t > decay ? 0 : peak * Math.exp((-6.9 * (t - att)) / (decay - att));
}

/** [frequency ratio, level, decay seconds] */
type Partial = [number, number, number];

/** A struck note (bell, mallet, string): sine partials, each fading on its own. */
function strike(L: Loop, at: number, f: number, partials: Partial[], att = 0.005) {
  const n = L.n;
  const s0 = (((Math.round(at * L.rate)) % n) + n) % n;
  const attN = Math.max(1, Math.round(att * L.rate));
  for (const [ratio, amp, decay] of partials) {
    const fr = f * ratio;
    if (fr > L.rate * 0.45 || amp <= 0) continue;
    // Sine by rotation and the fade by a constant factor: no sin / exp per sample.
    const w = (2 * Math.PI * fr) / L.rate;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const fall = Math.exp(-6.9 / ((decay - att) * L.rate));
    const count = Math.min(n, Math.ceil(decay * L.rate));
    let re = 1;
    let im = 0;
    let g = amp;
    for (let i = 0, j = s0; i < count; i++, j = j + 1 === n ? 0 : j + 1) {
      const level = i < attN ? amp * (i / attN) * (i / attN) : (g *= fall);
      L.buf[j] += im * level;
      const r = re * cw - im * sw;
      im = re * sw + im * cw;
      re = r;
    }
  }
}

/** A gliding tone (bird song, chirp): frequency and level follow k = 0…1 over `dur`. */
function sweep(L: Loop, at: number, dur: number, freq: (k: number) => number, amp: (t: number, k: number) => number) {
  let phase = 0;
  L.write(at, Math.ceil(dur * L.rate), (t) => {
    const k = t / dur;
    phase += (2 * Math.PI * freq(k)) / L.rate;
    return Math.sin(phase) * amp(t, k);
  });
}

/** A tone held through the whole loop; its level per sample (`amp`) must repeat with the loop too. */
function steady(L: Loop, f: number, amp: Float32Array, phase = 0) {
  const w = (2 * Math.PI * L.tune(f)) / L.rate;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  let re = Math.cos(phase);
  let im = Math.sin(phase);
  for (let i = 0; i < L.n; i++) {
    L.buf[i] += im * amp[i];
    const r = re * cw - im * sw;
    im = re * sw + im * cw;
    re = r;
  }
}

/** Soft pad: each note as two slightly detuned voices (a slow shimmer). */
function pad(L: Loop, freqs: number[], level: (t: number) => number) {
  const amp = new Float32Array(L.n);
  for (let i = 0; i < L.n; i++) amp[i] = level(i / L.rate);
  freqs.forEach((f, i) => {
    steady(L, f * 0.9985, amp, i * 1.3);
    steady(L, f * 1.0015, amp, i * 2.1 + 0.7);
  });
}

/** `cycles` whole waves per loop, 0…1 (for swells that repeat with the loop). */
const lfo = (L: Loop, t: number, cycles: number, offset = 0) => 0.5 - 0.5 * Math.cos((2 * Math.PI * cycles * t) / L.len + offset);

/* ---------------- noise (wind, sea, leaves) ---------------- */

function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Filtered white noise for the whole loop (the filter runs round twice, so it joins up). */
function noise(L: Loop, seed: number, type: 'lowpass' | 'bandpass' | 'highpass', f: number, q = 0.707): Float32Array {
  const rnd = random(seed);
  const x = new Float32Array(L.n);
  for (let i = 0; i < L.n; i++) x[i] = rnd() * 2 - 1;
  const w0 = (2 * Math.PI * f) / L.rate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const [b0, b1, b2] =
    type === 'lowpass' ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : type === 'highpass' ? [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2] : [alpha, 0, -alpha];
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  const y = new Float32Array(L.n);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let k = 0; k < 2 * L.n; k++) {
    const xi = x[k % L.n];
    const yi = (b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = xi; y2 = y1; y1 = yi;
    if (k >= L.n) y[k - L.n] = yi;
  }
  return y;
}

function addNoise(L: Loop, source: Float32Array, amp: (t: number) => number) {
  for (let i = 0; i < L.n; i++) L.buf[i] += source[i] * amp(i / L.rate);
}

/* ---------------- space: echo and reverb, round the loop ---------------- */

function echo(L: Loop, delay: number, feedback: number, wet: number) {
  const n = L.n;
  const d = Math.round(delay * L.rate);
  const x = L.buf.slice();
  const y = x.slice();
  for (let pass = 0; pass < 3; pass++) for (let i = 0, j = n - d; i < n; i++, j = j + 1 === n ? 0 : j + 1) y[i] = x[i] + feedback * y[j];
  for (let i = 0; i < n; i++) L.buf[i] = x[i] + wet * (y[i] - x[i]);
}

/** Small hall (Schroeder / Freeverb style): six damped combs, then two all-pass diffusers. */
function reverb(L: Loop, wet: number, feedback = 0.85, damp = 0.35, size = 1) {
  const n = L.n;
  const x = L.buf.slice();
  const out = new Float32Array(n);
  const combs = [0.0297, 0.0371, 0.0411, 0.0437, 0.0503, 0.0571].map((s) => Math.round(s * size * L.rate));
  for (const d of combs) {
    const y = x.slice();
    let lp = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0, j = n - d; i < n; i++, j = j + 1 === n ? 0 : j + 1) {
        lp = y[j] * (1 - damp) + lp * damp;
        y[i] = x[i] + lp * feedback;
      }
    }
    for (let i = 0; i < n; i++) out[i] += (y[i] - x[i]) / combs.length;
  }
  for (const s of [0.0126, 0.01]) {
    const d = Math.round(s * size * L.rate);
    const src = out.slice();
    const g = 0.5;
    for (let pass = 0; pass < 2; pass++) for (let i = 0, j = n - d; i < n; i++, j = j + 1 === n ? 0 : j + 1) out[i] = -g * src[i] + src[j] + g * out[j];
  }
  for (let i = 0; i < n; i++) L.buf[i] = x[i] + wet * out[i];
}

/** Loud but clean: soft-clip, then −1 dBFS at the highest peak. */
function finish(L: Loop, drive: number): Float32Array {
  let mean = 0;
  for (let i = 0; i < L.n; i++) mean += L.buf[i] / L.n;
  let peak = 0;
  for (let i = 0; i < L.n; i++) {
    L.buf[i] = Math.tanh((L.buf[i] - mean) * drive);
    peak = Math.max(peak, Math.abs(L.buf[i]));
  }
  const gain = 0.89 / (peak || 1);
  for (let i = 0; i < L.n; i++) L.buf[i] *= gain;
  return L.buf;
}

/* ---------------- instruments ---------------- */

const marimba = (v: number): Partial[] => [[1, v * 0.55, 0.9], [2, v * 0.08, 0.35], [4, v * 0.16, 0.09]];
/** Glass bell: pure, long, with a faint shimmering octave. */
const glass = (v: number, d = 2): Partial[] => [[1, v * 0.5, d], [2.005, v * 0.11, d * 0.55], [3.01, v * 0.035, d * 0.3]];
/** Kalimba: warm tine with a short metallic click. */
const kalimba = (v: number): Partial[] => [[1, v * 0.5, 1.3], [2, v * 0.04, 0.5], [5.9, v * 0.12, 0.1]];
/** Tubular wind chime: the inharmonic ring of a metal tube. */
const tube = (v: number): Partial[] => [[1, v * 0.45, 3.2], [2.76, v * 0.2, 1.7], [5.4, v * 0.09, 0.8], [8.93, v * 0.04, 0.35]];
/** Plucked harp string. */
const harp = (v: number): Partial[] => [1, 2, 3, 4, 5, 6].map((k) => [k, (v * 0.42) / Math.pow(k, 1.4), 2.4 / Math.pow(k, 0.7)] as Partial);

const HZ = {
  E4: 329.63, G4: 392, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, Fs5: 739.99, G5: 783.99, A5: 880, B5: 987.77,
  C6: 1046.5, Cs6: 1108.73, D6: 1174.66, E6: 1318.51, Gs6: 1661.22,
  A6: 1760, B6: 1975.53, Cs7: 2217.46, E7: 2637.02, Fs7: 2959.96,
} as const;

/* ---------------- the ringtones ---------------- */

/** The original: marimba phrase answered by three bird-like chirps. */
function southStreet(L: Loop) {
  const NOTE = { E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51 };
  const PHRASE: [number, keyof typeof NOTE, number][] = [
    [0.0, 'E5', 0.8], [0.16, 'G5', 0.7], [0.32, 'A5', 0.75], [0.48, 'C6', 0.9],
    [0.8, 'A5', 0.7], [0.96, 'C6', 0.75], [1.12, 'D6', 0.8], [1.28, 'E6', 1],
    [1.6, 'D6', 0.7], [1.76, 'C6', 0.7], [1.92, 'A5', 0.75], [2.08, 'G5', 0.85],
  ];
  PHRASE.forEach(([dt, n, v]) => strike(L, dt + 0.02, NOTE[n], marimba(v), 0.006));
  const chirp = (at: number, from: number, to: number, dur: number) =>
    sweep(L, at + 0.02, dur, (k) => (k < 0.7 ? from * Math.pow(to / from, k / 0.7) : to * Math.pow((from * 1.1) / to, (k - 0.7) / 0.3)), (t) => env(t, 0.22, 0.012, dur));
  chirp(2.42, 2600, 3900, 0.11);
  chirp(2.56, 2800, 4300, 0.1);
  chirp(2.74, 3000, 4600, 0.14);
  return finish(L, 1.8);
}

/** Orbit: a Lydian arpeggio of glass bells circling through a long echo, over a low drone. */
function orbit(L: Loop) {
  const step = 0.2;
  const seq: [number, number, number][] = [
    [0, HZ.D5, 0.9], [1, HZ.A5, 0.7], [2, HZ.E6, 0.8], [3, HZ.Gs6, 0.75], [4, HZ.E6, 0.6], [5, HZ.Cs6, 0.7], [6, HZ.A5, 0.65], [7, HZ.Fs5, 0.7],
    [10, HZ.Cs6, 0.8], [12, HZ.E6, 0.6],
    [16, HZ.E5, 0.9], [17, HZ.A5, 0.7], [18, HZ.Cs6, 0.8], [19, HZ.Gs6, 0.8], [20, HZ.E6, 0.6], [21, HZ.Cs6, 0.65], [22, HZ.A5, 0.6], [23, HZ.E5, 0.65],
    [26, HZ.Fs5, 0.7], [28, HZ.A5, 0.75],
  ];
  for (const [s, f, v] of seq) strike(L, s * step, f, glass(v, 1.8));
  echo(L, 0.6, 0.42, 0.55);
  pad(L, [146.83, 220, 329.63], (t) => 0.035 + 0.025 * lfo(L, t, 1));
  reverb(L, 0.45, 0.86);
  return finish(L, 1.5);
}

/** Stardust: a rising glass motif, twinkles scattered like stars, a deep warm drone. */
function stardust(L: Loop) {
  pad(L, [110, 164.81, 220, 277.18], (t) => 0.03 + 0.03 * lfo(L, t, 2));
  const rnd = random(7);
  const stars = [HZ.A6, HZ.B6, HZ.Cs7, HZ.E7, HZ.Fs7];
  for (let i = 0; i < 34; i++) {
    const at = rnd() * L.len;
    strike(L, at, stars[Math.floor(rnd() * stars.length)], glass(0.1 + rnd() * 0.18, 0.35 + rnd() * 0.4), 0.002);
  }
  const motif: [number, number, number][] = [
    [0, HZ.A5, 0.8], [0.18, HZ.Cs6, 0.75], [0.36, HZ.E6, 0.85], [0.9, HZ.A6, 0.6],
    [3, HZ.Fs5, 0.8], [3.18, HZ.A5, 0.75], [3.36, HZ.Cs6, 0.85], [3.9, HZ.E6, 0.65],
  ];
  for (const [at, f, v] of motif) strike(L, at, f, glass(v, 2.2));
  echo(L, 0.375, 0.35, 0.35);
  reverb(L, 0.5, 0.87);
  return finish(L, 1.5);
}

/** Nebula: two soft chords that slowly melt into each other, a passing whoosh, a dreamy bell. */
function nebula(L: Loop) {
  pad(L, [174.61, 261.63, 329.63, 392, 440], (t) => 0.03 * (0.15 + 0.85 * lfo(L, t, 1, Math.PI)));
  pad(L, [146.83, 220, 261.63, 329.63, 349.23], (t) => 0.03 * (0.15 + 0.85 * lfo(L, t, 1)));
  addNoise(L, noise(L, 11, 'bandpass', 800, 0.7), (t) => 0.12 * Math.pow(lfo(L, t, 2, Math.PI), 2));
  const bell: [number, number, number][] = [
    [0, HZ.A5, 0.85], [0.45, HZ.C6, 0.7], [0.9, HZ.E6, 0.8], [1.8, HZ.D6, 0.6],
    [4, HZ.G5, 0.8], [4.45, HZ.A5, 0.7], [4.9, HZ.E6, 0.8], [5.8, HZ.C6, 0.65],
  ];
  for (const [at, f, v] of bell) strike(L, at, f, glass(v, 2.6));
  echo(L, 0.45, 0.45, 0.4);
  reverb(L, 0.55, 0.88, 0.4, 1.2);
  return finish(L, 1.4);
}

function bird(L: Loop, at: number, from: number, to: number, dur: number, vel: number, trill = 0, depth = 0) {
  sweep(
    L,
    at,
    dur,
    (k) => from * Math.pow(to / from, k) * (1 + depth * Math.sin(2 * Math.PI * trill * k * dur)),
    (_t, k) => vel * Math.pow(Math.sin(Math.PI * k), 2)
  );
}

/** Forest morning: a breeze in the leaves, a calm kalimba tune, birds answering. */
function forest(L: Loop) {
  addNoise(L, noise(L, 3, 'lowpass', 900), (t) => 0.05 + 0.05 * lfo(L, t, 2));
  const tune: [number, number, number][] = [
    [0, HZ.E5, 0.75], [0.25, HZ.G5, 0.7], [0.5, HZ.A5, 0.75], [0.75, HZ.C6, 0.8], [1.25, HZ.A5, 0.65], [1.5, HZ.G5, 0.7],
    [3, HZ.D5, 0.75], [3.25, HZ.E5, 0.7], [3.5, HZ.G5, 0.75], [3.75, HZ.A5, 0.8], [4.25, HZ.G5, 0.65], [4.5, HZ.E5, 0.75],
  ];
  for (const [at, f, v] of tune) strike(L, at, f, kalimba(v), 0.003);
  // A robin's warble…
  bird(L, 2.05, 3000, 4100, 0.1, 0.16);
  bird(L, 2.2, 3300, 4400, 0.09, 0.15);
  bird(L, 2.35, 4200, 2900, 0.16, 0.16, 28, 0.04);
  // …a distant two-note whistle…
  bird(L, 1.0, 2600, 2500, 0.18, 0.06);
  bird(L, 1.25, 2200, 2100, 0.22, 0.06);
  // …and a quick trill.
  for (let i = 0; i < 6; i++) bird(L, 5.05 + i * 0.075, 4300, 3500, 0.06, 0.12 - i * 0.008);
  bird(L, 5.6, 3600, 4600, 0.12, 0.12);
  reverb(L, 0.22, 0.8, 0.5, 0.8);
  return finish(L, 1.4);
}

/** Wind chimes: gusts of breeze set metal tubes ringing in a calm pentatonic scale. */
function chimes(L: Loop) {
  const gust = (t: number, at: number) => {
    const d = Math.min(Math.abs(t - at), L.len - Math.abs(t - at));
    return Math.exp(-(d * d) / 0.8);
  };
  addNoise(L, noise(L, 5, 'bandpass', 520, 0.5), (t) => 0.03 + 0.12 * (gust(t, 0.4) + gust(t, 3.8)));
  const scale = [HZ.D5, HZ.E5, HZ.Fs5, HZ.A5, HZ.B5, HZ.D6];
  const rnd = random(19);
  let last = -1;
  const ring = (at: number) => {
    let i = Math.floor(rnd() * scale.length);
    if (i === last) i = (i + 2) % scale.length;
    last = i;
    strike(L, at, scale[i], tube(0.5 + rnd() * 0.4), 0.002);
  };
  for (const [start, count] of [[0, 5], [3.4, 6]] as const) {
    let at = start;
    for (let k = 0; k < count; k++) {
      ring(at);
      at += 0.12 + rnd() * 0.22;
    }
  }
  ring(2.3);
  ring(5.9);
  reverb(L, 0.3, 0.84, 0.3);
  return finish(L, 1.3);
}

/** Waves: two slow waves rolling onto the shore, a soft harp between them. */
function waves(L: Loop) {
  // Each 4 s wave builds for ~2.6 s, then breaks and draws back.
  const swell = (t: number) => {
    const p = (t % 4) / 4;
    return p < 0.65 ? Math.pow(Math.sin((p / 0.65) * (Math.PI / 2)), 2) : Math.pow(Math.cos(((p - 0.65) / 0.35) * (Math.PI / 2)), 1.5);
  };
  addNoise(L, noise(L, 23, 'lowpass', 600), (t) => 0.04 + 0.3 * swell(t));
  addNoise(L, noise(L, 29, 'highpass', 2500), (t) => 0.06 * Math.pow(swell(t), 3));
  const arp: [number, number, number][] = [
    [0, HZ.G4, 0.75], [0.16, HZ.B4, 0.7], [0.32, HZ.D5, 0.75], [0.48, HZ.G5, 0.8], [0.95, HZ.A5, 0.65], [1.3, HZ.G5, 0.6],
    [4, HZ.E4, 0.75], [4.16, HZ.G4, 0.7], [4.32, HZ.B4, 0.75], [4.48, HZ.E5, 0.8], [4.95, HZ.D5, 0.65], [5.3, HZ.B4, 0.6],
  ];
  for (const [at, f, v] of arp) strike(L, at, f, harp(v), 0.004);
  reverb(L, 0.35, 0.85, 0.4);
  return finish(L, 1.3);
}

const RENDER: Record<RingtoneId, (L: Loop) => Float32Array> = {
  'south-street': southStreet,
  orbit,
  stardust,
  nebula,
  forest,
  chimes,
  waves,
};

/** One seamless loop of the ringtone, mono, at `rate` samples per second, peaks at −1 dBFS. */
export function renderRingtone(id: RingtoneId, rate: number): Float32Array {
  return RENDER[id](new Loop(rate, ringtoneSeconds(id)));
}

/** 16-bit mono PCM WAV of samples in −1…1. */
export function toWav(samples: Float32Array, rate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(out.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return out;
}

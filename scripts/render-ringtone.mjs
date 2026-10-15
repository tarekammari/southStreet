#!/usr/bin/env node
/**
 * Renders the Connect ringtone (the same marimba phrase + bird chirps as
 * lib/connect/rtc.ts) to a WAV file the native apps loop while a call rings.
 *
 *   node scripts/render-ringtone.mjs native/assets/ringtone.wav
 */
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'native/assets/ringtone.wav';
const RATE = 44100;
const LOOP_S = 3.4;
const buf = new Float32Array(Math.round(RATE * LOOP_S));

const NOTE = { E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51 };
const PHRASE = [
  [0.0, 'E5', 0.8], [0.16, 'G5', 0.7], [0.32, 'A5', 0.75], [0.48, 'C6', 0.9],
  [0.8, 'A5', 0.7], [0.96, 'C6', 0.75], [1.12, 'D6', 0.8], [1.28, 'E6', 1],
  [1.6, 'D6', 0.7], [1.76, 'C6', 0.7], [1.92, 'A5', 0.75], [2.08, 'G5', 0.85],
];

/** Exponential attack to `peak` in `att` s, then exponential decay to silence at `decay` s. */
function env(t, peak, att, decay) {
  if (t < 0 || t > decay) return 0;
  if (t < att) return peak * Math.pow(t / att, 2);
  return peak * Math.exp(-6.9 * ((t - att) / (decay - att)));
}

function addMarimba(start, freq, vel) {
  const parts = [[1, vel * 0.55, 0.9], [2, vel * 0.08, 0.35], [4, vel * 0.16, 0.09]];
  for (const [mul, peak, decay] of parts) {
    const s0 = Math.round((start + 0.02) * RATE);
    const n = Math.round(decay * RATE);
    for (let i = 0; i < n && s0 + i < buf.length; i++) {
      const t = i / RATE;
      buf[s0 + i] += Math.sin(2 * Math.PI * freq * mul * t) * env(t, peak, 0.006, decay);
    }
  }
}

function addChirp(start, from, to, dur) {
  const s0 = Math.round((start + 0.02) * RATE);
  let phase = 0;
  for (let i = 0; i < dur * RATE && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const k = t / dur;
    const f = k < 0.7 ? from * Math.pow(to / from, k / 0.7) : to * Math.pow((from * 1.1) / to, (k - 0.7) / 0.3);
    phase += (2 * Math.PI * f) / RATE;
    buf[s0 + i] += Math.sin(phase) * env(t, 0.22, 0.012, dur);
  }
}

PHRASE.forEach(([dt, n, v]) => addMarimba(dt, NOTE[n], v));
addChirp(2.42, 2600, 3900, 0.11);
addChirp(2.56, 2800, 4300, 0.1);
addChirp(2.74, 3000, 4600, 0.14);

// Loud but clean: soft-clip, then normalise to -1 dBFS.
let peak = 0;
for (let i = 0; i < buf.length; i++) {
  buf[i] = Math.tanh(buf[i] * 1.8);
  peak = Math.max(peak, Math.abs(buf[i]));
}
const gain = 0.89 / (peak || 1);

const data = Buffer.alloc(buf.length * 2);
for (let i = 0; i < buf.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * gain)) * 32767), i * 2);
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, data]));
console.log(`ringtone → ${out} (${LOOP_S}s, ${Math.round((44 + data.length) / 1024)} KB)`);

/**
 * Renders the Connect ringtones (lib/connect/ringtones.ts, the same code the
 * web app plays) to WAV files the native apps loop while a call rings:
 *   native/assets, native/windows/assets and native/android/app/src/main/res/raw
 * The original tone stays `ringtone.wav`; the others are `ringtone_<id>.wav`.
 *
 *   npm run connect:ringtones            # write the files
 *   npm run connect:ringtones -- --stats # only print loudness / loop-seam checks
 */
import fs from 'node:fs';
import path from 'node:path';
import { RINGTONES, renderRingtone, toWav, type RingtoneId } from '../lib/connect/ringtones';

const statsOnly = process.argv.includes('--stats');
const DIRS = ['native/assets', 'native/windows/assets', 'native/android/app/src/main/res/raw'];
// The original keeps its old quality; the newer ones are 32 kHz to keep the apps small.
const rateOf = (id: RingtoneId) => (id === 'south-street' ? 44100 : 32000);
export const ringtoneFile = (id: RingtoneId) => (id === 'south-street' ? 'ringtone.wav' : `ringtone_${id.replace(/-/g, '_')}.wav`);

const db = (x: number) => (20 * Math.log10(Math.max(x, 1e-9))).toFixed(1);

for (const r of RINGTONES) {
  const rate = rateOf(r.id);
  const t0 = performance.now();
  const s = renderRingtone(r.id, rate);
  const ms = performance.now() - t0;
  let sum = 0;
  let step = 0;
  for (let i = 0; i < s.length; i++) {
    sum += s[i] * s[i];
    if (i) step = Math.max(step, Math.abs(s[i] - s[i - 1]));
  }
  // The jump at the loop point compared with the largest jump inside the loop.
  const seam = Math.abs(s[0] - s[s.length - 1]);
  console.log(`${r.id.padEnd(13)} ${r.seconds}s  rms ${db(Math.sqrt(sum / s.length))} dBFS  seam ${seam.toFixed(4)} (max step ${step.toFixed(4)})  ${ms.toFixed(0)} ms`);
  if (statsOnly) continue;
  const wav = toWav(s, rate);
  for (const dir of DIRS) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, ringtoneFile(r.id)), wav);
  }
}
if (!statsOnly) console.log(`→ ${DIRS.join(', ')}`);

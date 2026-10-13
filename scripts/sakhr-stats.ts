/** npm run sakhr:stats [-- 24]   How Sakhr coped over the last N hours (default 24). */
import 'dotenv/config';
import { readStats } from '../lib/sakhr/capacity';

const s = readStats(Number(process.argv[2]) || 24);
console.log(`Sakhr, last ${s.hours} h`);
console.log(`  answers: ${s.answers}  (from cache: ${s.cached})   failed: ${s.failed}`);
console.log(`  speed: average ${(s.avgMs / 1000).toFixed(1)} s, 95% under ${(s.p95Ms / 1000).toFixed(1)} s`);
console.log(`  busiest minute: ${s.busiestMinute} messages   tokens used: ${s.tokens}`);
console.log(`  answered by: ${Object.entries(s.byProvider).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
process.exit(0);

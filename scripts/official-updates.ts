/**
 * npm run official:refresh [-- --if-due]   collect official Hajj/Umrah updates now
 *                                          (--if-due: only when the last run is ~3 days old)
 * npm run official:list                    show what is stored
 * On the VPS, PM2 runs "--if-due" every night at 02:00 (ecosystem.config.cjs).
 */
import 'dotenv/config';
import { listOfficialUpdates, officialUpdatesDue, refreshOfficialUpdates } from '../lib/sakhr/official-updates';

(async () => {
  const cmd = process.argv[2] || 'refresh';
  if (cmd === 'list') {
    for (const u of listOfficialUpdates()) {
      console.log(`\n■ ${u.title}  [${u.status}]  collected ${u.fetchedAt?.slice(0, 16) || '—'}  changed ${u.changedAt?.slice(0, 10) || '—'}`);
      if (u.answer) console.log(`  ${u.answer.replace(/\s+/g, ' ').slice(0, 220)}…`);
      for (const s of u.sources.slice(0, 3)) console.log(`  - ${s.publisher}: ${s.url}`);
    }
    process.exit(0);
  }
  if (process.argv.includes('--if-due') && !officialUpdatesDue()) {
    console.log(`${new Date().toISOString()} official updates are recent: nothing to do.`);
    process.exit(0);
  }
  console.log(`${new Date().toISOString()} collecting official Hajj/Umrah updates…`);
  const s = await refreshOfficialUpdates({ log: (l) => console.log(`  ${l}`) });
  console.log(`done: ${s.fresh} refreshed (${s.changed} changed), ${s.kept} kept, ${s.failed} failed`);
  process.exit(0);
})().catch((err) => {
  console.error('official updates failed:', err?.message || err);
  process.exit(1);
});

/**
 * npm run db:backup [-- --reason=auto|manual|pre-update]
 * Safe while the app is running. On the VPS, cron runs it every night (see DEPLOY.md).
 */
import 'dotenv/config';
import { createBackup, backupDir } from '../lib/backup';

const arg = process.argv.find((a) => a.startsWith('--reason='))?.split('=')[1];
const reason = (['auto', 'manual', 'pre-update'].includes(arg || '') ? arg : 'manual') as 'auto' | 'manual' | 'pre-update';

createBackup(reason)
  .then((b) => {
    console.log(`Backup created: ${backupDir()}/${b.name} (${(b.size / 1024).toFixed(0)} KB), ${b.uploadsCopied} new upload(s) mirrored.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Backup failed:', err?.message || err);
    process.exit(1);
  });

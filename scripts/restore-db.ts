/**
 * npm run db:restore -- <backup-file-name>       (STOP THE APP FIRST)
 *
 * Restores a backup made by db:backup. The current database is saved first as a
 * "pre-restore" backup, so a restore can itself be undone.
 * The restored data needs the same DB_ENCRYPTION_SECRET / DB_LOOKUP_SECRET it was made with.
 */
import 'dotenv/config';
import fs from 'fs';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { resolveDbPath } from '../lib/db-path';
import { backupFilePath, createBackup } from '../lib/backup';
import { getSqliteDb } from '../lib/sqlite';

(async () => {
  const name = process.argv[2];
  const file = name ? backupFilePath(name) : null;
  if (!file) {
    console.error('Usage: npm run db:restore -- south_street-YYYYMMDD-HHMMSS-<reason>.db.gz   (see the backups folder)');
    process.exit(1);
  }
  const target = resolveDbPath();
  if (fs.existsSync(target)) {
    const safety = await createBackup('pre-restore');
    console.log(`Current database saved as ${safety.name}`);
    // Release the file before replacing it (Windows will not overwrite an open file).
    (getSqliteDb() as unknown as { close?: () => void }).close?.();
  }
  const tmp = `${target}.restoring`;
  await pipeline(fs.createReadStream(file), zlib.createGunzip(), fs.createWriteStream(tmp));
  for (const ext of ['-wal', '-shm']) fs.rmSync(`${target}${ext}`, { force: true });
  fs.renameSync(tmp, target);
  console.log(`Restored ${name} → ${target}. Start the app again.`);
  process.exit(0);
})().catch((err) => {
  console.error('Restore failed:', err?.message || err);
  process.exit(1);
});

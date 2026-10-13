/**
 * npm run db:restore -- <backup-file-name> [--key <backup-private-key.pem>]   (STOP THE APP FIRST)
 *
 * Restores a backup made by db:backup. The current database is saved first as a
 * "pre-restore" backup, so a restore can itself be undone.
 * Encrypted backups (*.db.gz.enc) need the owner's private backup key: bring it to
 * the server only for the restore, then delete it (BACKUP_KEY_PASSPHRASE if it has one).
 * The restored data needs the database secrets it was made with (the recovery kit
 * named in the backup: npm run backup:key -- open recovery-kit-<id>.env.enc ...).
 */
import 'dotenv/config';
import fs from 'fs';
import zlib from 'zlib';
import { resolveDbPath } from '../lib/db-path';
import { backupFilePath, createBackup, dbKeyId } from '../lib/backup';
import { decryptBackup } from '../lib/backup-crypto';
import { getSqliteDb } from '../lib/sqlite';

(async () => {
  const name = process.argv[2];
  const file = name ? backupFilePath(name) : null;
  if (!file) {
    console.error('Usage: npm run db:restore -- south_street-YYYYMMDD-HHMMSS-<reason>.db.gz[.enc] [--key backup-private-key.pem]');
    process.exit(1);
  }

  // Open the backup before touching anything, so a wrong key changes nothing.
  let gz: Buffer = fs.readFileSync(file);
  if (file.endsWith('.enc')) {
    const i = process.argv.indexOf('--key');
    const keyFile = i > -1 ? process.argv[i + 1] : '';
    if (!keyFile || !fs.existsSync(keyFile)) {
      console.error('This backup is encrypted: add --key <backup-private-key.pem>');
      process.exit(1);
    }
    const { header, plain } = decryptBackup(gz, fs.readFileSync(keyFile), process.env.BACKUP_KEY_PASSPHRASE || undefined);
    if (header.dbKid !== dbKeyId()) {
      console.error(`This backup needs database key ${header.dbKid}, but the app uses ${dbKeyId()}.`);
      console.error(`Put the secrets from recovery-kit-${header.dbKid}.env.enc in .env first.`);
      process.exit(1);
    }
    gz = plain;
  }
  const db = zlib.gunzipSync(gz);

  const target = resolveDbPath();
  if (fs.existsSync(target)) {
    const safety = await createBackup('pre-restore');
    console.log(`Current database saved as ${safety.name}`);
    // Release the file before replacing it (Windows will not overwrite an open file).
    (getSqliteDb() as unknown as { close?: () => void }).close?.();
  }
  const tmp = `${target}.restoring`;
  fs.writeFileSync(tmp, db, { mode: 0o600 });
  for (const ext of ['-wal', '-shm']) fs.rmSync(`${target}${ext}`, { force: true });
  fs.renameSync(tmp, target);
  console.log(`Restored ${name} → ${target}. Start the app again.`);
  process.exit(0);
})().catch((err) => {
  console.error('Restore failed:', err?.message || err);
  process.exit(1);
});

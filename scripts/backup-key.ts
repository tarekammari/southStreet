/**
 * The owner's backup key (run on YOUR PC, never on the server).
 *
 *   npm run backup:key -- generate --out <folder>
 *       creates backup-private-key.pem (keep offline: USB / password manager)
 *       and backup-public-key.pem (goes on the server, BACKUP_PUBLIC_KEY_FILE).
 *
 *   npm run backup:key -- open <file.enc> --key <backup-private-key.pem> [--out <file>]
 *       opens an encrypted backup (writes the .db) or a recovery kit (writes the .env).
 *
 * Optional passphrase for the private key: set BACKUP_KEY_PASSPHRASE before running
 * (generate protects the key with it; open uses it).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { decryptBackup, publicKeyId, readHeader } from '../lib/backup-crypto';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : undefined;
};
const passphrase = process.env.BACKUP_KEY_PASSPHRASE || undefined;

function generate() {
  const out = path.resolve(opt('out') || '.');
  fs.mkdirSync(out, { recursive: true });
  const privFile = path.join(out, 'backup-private-key.pem');
  const pubFile = path.join(out, 'backup-public-key.pem');
  if (fs.existsSync(privFile)) throw new Error(`${privFile} already exists: not overwritten (it may be the only key to your backups).`);
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: passphrase
      ? { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase }
      : { type: 'pkcs8', format: 'pem' },
  });
  fs.writeFileSync(privFile, privateKey, { mode: 0o600 });
  fs.writeFileSync(pubFile, publicKey);
  console.log(`Private key: ${privFile}${passphrase ? ' (passphrase-protected)' : ''}`);
  console.log(`Public key:  ${pubFile}`);
  console.log(`Key id:      ${publicKeyId(crypto.createPublicKey(publicKey))}`);
  console.log('\nKeep the PRIVATE key offline and backed up twice. Without it no backup can ever be opened.');
}

function open() {
  const file = args[1];
  const keyFile = opt('key');
  if (!file || !keyFile) throw new Error('Usage: npm run backup:key -- open <file.enc> --key <backup-private-key.pem> [--out <file>]');
  const data = fs.readFileSync(file);
  const { header, plain } = decryptBackup(data, fs.readFileSync(keyFile), passphrase);
  const isKit = path.basename(file).startsWith('recovery-kit-');
  const content = isKit ? plain : zlib.gunzipSync(plain);
  const out = opt('out') || file.replace(/\.enc$/, '').replace(/\.gz$/, '');
  fs.writeFileSync(out, content, { mode: 0o600 });
  console.log(`Opened ${path.basename(file)} → ${out} (${(content.length / 1024).toFixed(0)} KB)`);
  console.log(`Needs database key ${header.dbKid}: use recovery-kit-${header.dbKid}.env.enc for its secrets.`);
}

try {
  if (args[0] === 'generate') generate();
  else if (args[0] === 'open') open();
  else if (args[0] === 'info' && args[1]) console.log(readHeader(fs.readFileSync(args[1])).header);
  else console.log('Usage: npm run backup:key -- generate --out <folder> | open <file.enc> --key <private.pem> [--out <file>] | info <file.enc>');
} catch (err) {
  console.error(String((err as Error)?.message || err));
  process.exit(1);
}

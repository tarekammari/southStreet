import crypto from 'crypto';
import fs from 'fs';
import { Transform } from 'stream';

/**
 * Backups encrypted to a public key: the server can write them but can never read
 * them back. Only the private key, kept offline by the owner (npm run backup:key),
 * opens them. A stolen server, disk snapshot or backup folder therefore gives
 * nothing readable, even together with the database secrets.
 *
 * File: "SSBK1" | u32 header length | header JSON | AES-256-GCM ciphertext | 16-byte tag
 * Header: the random file key wrapped with RSA-OAEP-SHA256, the IV, and short
 * fingerprints of the backup key and of the database secret the data needs.
 */

const MAGIC = Buffer.from('SSBK1');
const TAG_BYTES = 16;

export type BackupHeader = { v: 1; alg: 'RSA-OAEP-256+A256GCM'; kid: string; dbKid: string; key: string; iv: string };

/** Short, non-reversible fingerprint (safe to store in clear). */
export function fingerprint(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/** BACKUP_PUBLIC_KEY_FILE (a PEM file) turns encryption on; without it backups stay as before. */
export function backupPublicKey(): crypto.KeyObject | null {
  const file = process.env.BACKUP_PUBLIC_KEY_FILE?.trim();
  if (!file) return null;
  if (!fs.existsSync(file)) throw new Error(`BACKUP_PUBLIC_KEY_FILE not found: ${file}`);
  return crypto.createPublicKey(fs.readFileSync(file));
}

export function publicKeyId(key: crypto.KeyObject): string {
  return fingerprint(key.export({ type: 'spki', format: 'der' }));
}

/** Stream that turns plain bytes into an encrypted backup file. */
export function encryptStream(publicKey: crypto.KeyObject, dbKid: string): Transform {
  const fileKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv);
  const header: BackupHeader = {
    v: 1,
    alg: 'RSA-OAEP-256+A256GCM',
    kid: publicKeyId(publicKey),
    dbKid,
    key: crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, fileKey).toString('base64'),
    iv: iv.toString('base64'),
  };
  const json = Buffer.from(JSON.stringify(header));
  const len = Buffer.alloc(4);
  len.writeUInt32BE(json.length);
  let started = false;
  const start = (t: Transform) => {
    if (!started) {
      started = true;
      t.push(Buffer.concat([MAGIC, len, json]));
    }
  };
  return new Transform({
    transform(chunk, _enc, cb) {
      start(this);
      cb(null, cipher.update(chunk));
    },
    flush(cb) {
      start(this);
      cb(null, Buffer.concat([cipher.final(), cipher.getAuthTag()]));
    },
  });
}

export function encryptBuffer(publicKey: crypto.KeyObject, dbKid: string, data: Buffer): Buffer {
  const parts: Buffer[] = [];
  const t = encryptStream(publicKey, dbKid);
  t.on('data', (c: Buffer) => parts.push(c));
  t.end(data);
  return Buffer.concat(parts);
}

export function isEncryptedBackup(data: Buffer): boolean {
  return data.length > MAGIC.length + 4 && data.subarray(0, MAGIC.length).equals(MAGIC);
}

export function readHeader(data: Buffer): { header: BackupHeader; bodyStart: number } {
  if (!isEncryptedBackup(data)) throw new Error('Not an encrypted South Street backup');
  const len = data.readUInt32BE(MAGIC.length);
  const start = MAGIC.length + 4;
  return { header: JSON.parse(data.subarray(start, start + len).toString('utf8')), bodyStart: start + len };
}

/** Opens a backup with the owner's private key (PEM, optionally passphrase-protected). */
export function decryptBackup(data: Buffer, privateKeyPem: string | Buffer, passphrase?: string): { header: BackupHeader; plain: Buffer } {
  const { header, bodyStart } = readHeader(data);
  const privateKey = crypto.createPrivateKey(passphrase ? { key: privateKeyPem, passphrase } : privateKeyPem);
  const pub = crypto.createPublicKey(privateKey);
  if (publicKeyId(pub) !== header.kid) throw new Error('This backup was encrypted for a different backup key');
  const fileKey = crypto.privateDecrypt({ key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(header.key, 'base64'));
  const body = data.subarray(bodyStart, data.length - TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, Buffer.from(header.iv, 'base64'));
  decipher.setAuthTag(data.subarray(data.length - TAG_BYTES));
  return { header, plain: Buffer.concat([decipher.update(body), decipher.final()]) };
}

/**
 * Fingerprint of the code that creates / migrates / seeds the database.
 *
 * On Turso (Vercel) the start-up setup is hundreds of remote writes, far too slow
 * to repeat on every cold start. The setup runs once, stores this fingerprint in
 * `app_meta`, and later starts skip it until one of these files changes.
 * Computed at build time by next.config.js (the files are not deployed) and
 * directly by the scripts.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const INIT_FILES = [
  'lib/sqlite.ts',
  'lib/security-schema.ts',
  'lib/encrypted-sqlite.ts',
  'lib/scf-chart-seed.ts',
  'lib/finance-periods.ts',
  'lib/accounts.ts',
  'lib/package-status.ts',
];

function dbInitVersion(root = path.join(__dirname, '..')) {
  const hash = crypto.createHash('sha256');
  for (const file of INIT_FILES) {
    try {
      // Line endings ignored: Windows (CRLF) and the Vercel build (LF) must agree.
      hash.update(file).update(fs.readFileSync(path.join(root, file), 'utf8').split('\r\n').join('\n'));
    } catch {
      hash.update(`${file}:missing`);
    }
  }
  return hash.digest('hex').slice(0, 16);
}

module.exports = { dbInitVersion, INIT_FILES };

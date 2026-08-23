import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { ensureUserAccount, updateUserAccess } from '../lib/accounts';
import { getSqliteDb } from '../lib/sqlite';
import { generateNewSecurityKey } from '../lib/security';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Admin@2026!';
const ADMIN_EMAIL = 'admin@southstreet.dz';

const issued = ensureUserAccount({
  id: 'usr_super_admin',
  name: 'طارق العماري (المدير العام)',
  email: ADMIN_EMAIL,
  username: ADMIN_USERNAME,
  password: ADMIN_PASSWORD,
  role: 'SUPER_ADMIN',
  roleName: 'مدير النظام العام',
  status: 'APPROVED',
  issueSecrets: true,
});

updateUserAccess(issued.userId, {
  status: 'APPROVED',
  role: 'SUPER_ADMIN',
  roleName: 'مدير النظام العام',
  loginEnabled: 1,
});

const { keyString, fileContent } = generateNewSecurityKey();
const db = getSqliteDb();
try {
  db.prepare("UPDATE agency_settings SET security_key = ? WHERE id = 'main'").run(keyString);
} catch (err) {
  console.warn('Could not store security key in agency_settings:', err);
}

const keyPath = path.join(process.cwd(), 'southstreet_admin.key');
fs.writeFileSync(keyPath, fileContent, 'utf8');

console.log(JSON.stringify({
  ok: true,
  username: ADMIN_USERNAME,
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
  role: 'SUPER_ADMIN',
  keyFile: keyPath,
  keyId: keyString,
}, null, 2));

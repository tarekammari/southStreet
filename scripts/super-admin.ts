/**
 * Super Admin management — run on the server only.
 *
 *   npm run admin:setup              create THE Super Admin (refuses if one exists)
 *   npm run admin:recover            lost every key: wipe keys + codes, issue a new activation link
 *   npm run admin:status             show the Super Admin and its key count
 *
 * The app itself can never create, promote to, or recover the Super Admin.
 * Each command prints a one-time activation link: open it, set a password and
 * register your security keys.
 */
import 'dotenv/config';
import readline from 'readline';
import { getSqliteDb } from '../lib/sqlite';
import { ensureUserAccount } from '../lib/accounts';
import { dbLogAudit } from '../lib/db';
import { LOGIN_ROLE_LABELS } from '../lib/roles';
import { SUPER_ADMIN_WHERE } from '../lib/security-schema';
import { appOrigin, countCredentials, createEnrollmentToken, resetSecurityFactors, remainingRecoveryCodes } from '../lib/webauthn';

const LINK_MINUTES = 30;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

function currentSuperAdmin(): any | null {
  return getSqliteDb().prepare(`SELECT * FROM users WHERE ${SUPER_ADMIN_WHERE}`).get() || null;
}

function printLink(userId: string, reason: string) {
  const token = createEnrollmentToken(userId, reason, 'server-cli', LINK_MINUTES);
  console.log('\n  Activation link (single use, expires in %d minutes):\n', LINK_MINUTES);
  console.log(`  ${appOrigin()}/enroll?t=${encodeURIComponent(token)}\n`);
  console.log('  Open it in the browser on this machine (or over HTTPS on your domain),');
  console.log('  set a new password and register at least two security keys.\n');
}

async function setup() {
  const existing = currentSuperAdmin();
  if (existing) {
    console.error(`\n  A Super Admin already exists (${existing.username}). There can be only one.`);
    console.error('  Lost access? Run: npm run admin:recover\n');
    process.exit(1);
  }
  const name = arg('name') || (await ask('  Full name: '));
  const username = arg('username') || (await ask('  Username: '));
  const email = arg('email') || (await ask('  Email: '));
  if (!name || !username || !email.includes('@')) {
    console.error('  Name, username and a valid email are required.');
    process.exit(1);
  }
  const issued = ensureUserAccount({
    id: 'usr_super_admin',
    name,
    username,
    email,
    role: 'SUPER_ADMIN',
    roleName: LOGIN_ROLE_LABELS.SUPER_ADMIN,
    status: 'APPROVED',
    issueSecrets: false,
    allowSuperAdmin: true,
  });
  getSqliteDb().prepare('UPDATE users SET legacyKeyAllowed = 0 WHERE id = ?').run(issued.userId);
  dbLogAudit('server-cli', 'SUPER_ADMIN', 'إنشاء المشرف العام', username);
  console.log(`\n  Super Admin created: ${username}`);
  printLink(issued.userId, 'setup');
}

async function recover() {
  const admin = currentSuperAdmin();
  if (!admin) {
    console.error('\n  No Super Admin yet. Run: npm run admin:setup\n');
    process.exit(1);
  }
  const confirm = arg('yes') !== undefined || process.argv.includes('--yes')
    ? 'yes'
    : await ask(`  This removes every security key and recovery code of "${admin.username}" and signs it out everywhere. Type "yes": `);
  if (confirm !== 'yes') {
    console.log('  Cancelled.');
    return;
  }
  resetSecurityFactors(admin.id);
  getSqliteDb().prepare('UPDATE users SET legacyKeyAllowed = 0, loginEnabled = 1, status = ? WHERE id = ?').run('APPROVED', admin.id);
  dbLogAudit('server-cli', 'SUPER_ADMIN', 'استرداد حساب المشرف العام', admin.username);
  console.log(`\n  Security reset for ${admin.username}.`);
  printLink(admin.id, 'recover');
}

function status() {
  const admin = currentSuperAdmin();
  if (!admin) {
    console.log('\n  No Super Admin. Run: npm run admin:setup\n');
    return;
  }
  console.log(`\n  Super Admin: ${admin.name} (${admin.username})`);
  console.log(`  Security keys: ${countCredentials(admin.id)}`);
  console.log(`  Recovery codes left: ${remainingRecoveryCodes(admin.id)}`);
  console.log(`  Login enabled: ${admin.loginEnabled !== 0 ? 'yes' : 'no'}\n`);
}

const command = process.argv[2];
(async () => {
  if (command === 'setup') await setup();
  else if (command === 'recover') await recover();
  else if (command === 'status') status();
  else {
    console.log('Usage: tsx scripts/super-admin.ts <setup|recover|status>');
    process.exit(1);
  }
})().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

// Prints a one-time sign-in link (15 minutes, single use). Run on the server:
//   sudo -u mobilestore node --disable-warning=ExperimentalWarning --env-file=/home/mobilestore/.env scripts/login-link.js you@gmail.com
import path from 'node:path';
import { config } from '../lib/config.js';
import { openDb } from '../lib/db.js';
import { createLoginLink } from '../lib/auth.js';

const email = process.argv[2];
if (!email) { console.error('usage: login-link.js <email>'); process.exit(1); }
openDb(path.join(config.dataDir, 'mobile-store.db'));
console.log(createLoginLink(email));

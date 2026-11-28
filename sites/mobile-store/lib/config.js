import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const env = process.env;
const publicUrl = (env.PUBLIC_URL || 'http://localhost:3300').replace(/\/+$/, '');
const u = new URL(publicUrl);

export const config = {
  appName: env.APP_NAME || 'Mobilo',
  contactEmail: env.CONTACT_EMAIL || String(env.SUPER_ADMIN_EMAILS || '').split(/[\s,]+/)[0] || '',
  port: Number(env.PORT || 3300),
  host: env.HOST || '127.0.0.1',
  publicUrl,
  origin: u.origin,
  baseHost: u.host.toLowerCase(),             // e.g. mobile.1zayd1.tech or localhost:3300
  baseDomain: u.hostname.toLowerCase(),        // without port
  secure: u.protocol === 'https:',
  production: env.NODE_ENV === 'production',
  dataDir: env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data'),
  googleClientId: env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: env.GOOGLE_CLIENT_SECRET || '',
  superAdmins: new Set(String(env.SUPER_ADMIN_EMAILS || '').toLowerCase().split(/[\s,]+/).filter(Boolean)),
  secret: env.APP_SECRET || crypto.randomBytes(32).toString('hex'),
  devLogin: env.DEV_LOGIN === '1' && env.NODE_ENV !== 'production',
  trialDays: Number(env.TRIAL_DAYS || 30),
  maxStoresPerUser: Number(env.MAX_STORES_PER_USER || 3),
  // Subdomain stores get HTTPS once their certificate exists (see deploy/cert-worker.sh).
  storeUrlMode: env.STORE_URL_MODE || 'subdomain', // 'subdomain' | 'path'
};

export const PLANS = {
  trial: { products: 100000, members: 10, storageMb: 500 },
  free: { products: 30, members: 1, storageMb: 50 },
  pro: { products: 100000, members: 10, storageMb: 2000 },
  business: { products: 100000, members: 50, storageMb: 10000 },
};

export function planOf(store) {
  if (store.plan === 'trial' && store.plan_expires && store.plan_expires < Date.now()) return 'free';
  if (store.plan !== 'trial' && store.plan !== 'free' && store.plan_expires && store.plan_expires < Date.now()) return 'free';
  return PLANS[store.plan] ? store.plan : 'free';
}

export function storeUrl(slug) {
  if (config.storeUrlMode === 'path') return `${config.publicUrl}/s/${slug}/`;
  const u = new URL(config.publicUrl);
  return `${u.protocol}//${slug}.${u.host}/`;
}

const fs = require('fs');
const path = require('path');

function syncImages() {
  const srcDir = path.join(__dirname, 'images');
  const destDir = path.join(__dirname, 'public', 'images');
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.join(srcDir, file);
    let stat;
    try {
      stat = fs.statSync(srcFile);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const destFile = path.join(destDir, file);
    try {
      const dest = fs.statSync(destFile);
      if (dest.size === stat.size && dest.mtimeMs >= stat.mtimeMs) continue;
    } catch {
      /* destination missing */
    }
    fs.copyFileSync(srcFile, destFile);
  }
}

syncImages();

// Remove legacy index.html if present so Next.js App Router (app/page.tsx) is the sole handler
const legacyHtml = path.join(__dirname, 'index.html');
if (fs.existsSync(legacyHtml)) {
  try { fs.unlinkSync(legacyHtml); } catch (e) {}
}

/** @type {import('next').NextConfig} */
/**
 * Security headers for every response. The Content-Security-Policy only lets
 * scripts run from this site (and Google sign-in), and only lets the page talk to
 * this site — so even an injected script could not load code or send data away.
 */
const httpsSite = /^https:\/\//i.test(process.env.APP_ORIGIN || '');
const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://accounts.google.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self' https://accounts.google.com${isDev ? ' ws: wss:' : ''}`,
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.tiktok.com https://www.google.com https://accounts.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(httpsSite ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), publickey-credentials-get=(self), publickey-credentials-create=(self)',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  // HSTS only once the site is really served over HTTPS (never on localhost).
  ...(httpsSite ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

const { dbInitVersion } = require('./lib/db-init-version');

const nextConfig = {
  poweredByHeader: false,
  // Lets the app on Turso skip the start-up setup it already ran (lib/sqlite.ts).
  env: { DB_INIT_VERSION: dbInitVersion() },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // A second dev server (e.g. a preview on another port) can build into its own folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
    // Hotel videos are multipart uploads. The default 10MB clone limit
    // truncates the body and the parser reports "Failed to parse body as FormData".
    middlewareClientMaxBodySize: '90mb',
    serverActions: {
      bodySizeLimit: '90mb',
    },
  },
  // better-sqlite3 / libsql (Turso) are native Node modules — must not be bundled for Vercel
  serverExternalPackages: ['better-sqlite3', 'libsql', 'bcryptjs'],
  async rewrites() {
    return [
      { source: '/images/uploads/:filename', destination: '/api/staff-image/:filename' },
    ];
  },
};

module.exports = nextConfig;

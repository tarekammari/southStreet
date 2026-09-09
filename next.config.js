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
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // better-sqlite3 is a native Node module — must not be bundled for Vercel
  serverExternalPackages: ['better-sqlite3', 'bcryptjs'],
  async rewrites() {
    return [
      { source: '/images/uploads/:filename', destination: '/api/staff-image/:filename' },
    ];
  },
};

module.exports = nextConfig;

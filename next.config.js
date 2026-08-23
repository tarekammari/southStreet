const fs = require('fs');
const path = require('path');

// Ensure image assets in ./images are synced to ./public/images for Next.js static serving
const srcDir = path.join(__dirname, 'images');
const destDir = path.join(__dirname, 'public', 'images');

if (fs.existsSync(srcDir)) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    const srcFile = path.join(srcDir, file);
    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, path.join(destDir, file));
    }
  }
}

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
  serverExternalPackages: ['better-sqlite3'],
  async rewrites() {
    return [
      { source: '/images/uploads/:filename', destination: '/api/staff-image/:filename' },
    ];
  },
};

module.exports = nextConfig;

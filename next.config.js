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
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;

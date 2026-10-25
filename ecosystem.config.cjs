/**
 * PM2 processes on the VPS (see DEPLOY.md).
 *
 *   south-street         the web app (one process: SQLite has a single writer, and
 *                        login lockouts / presence are kept per process)
 *   south-street-backup  nightly database backup at 03:00 (runs, then exits)
 *   south-street-official-updates  nightly 02:00 check; refreshes official Hajj/Umrah
 *                        updates for Sakhr when the last refresh is ~3 days old
 *
 * NEXT_DIST_DIR is the build folder the app serves; scripts/update.sh builds the
 * next version into the other folder and switches to it with a reload.
 *
 * One install per agency (deploy/AGENCIES.md): PM2_APP and PORT in .env name the
 * processes (south-street-<slug>, south-street-<slug>-backup...) and the port.
 * BACKUP_CRON / OFFICIAL_UPDATES_CRON spread the nightly jobs of the agencies.
 * Without them: south-street on port 3000, 03:00 / 02:00, as before.
 */
const fs = require('fs');
const path = require('path');

const activeFile = path.join(__dirname, '.next-active');
const distDir = process.env.NEXT_DIST_DIR || (fs.existsSync(activeFile) ? fs.readFileSync(activeFile, 'utf8').trim() : '.next');

function dotenv(key) {
  try {
    const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
    return (m && m[1].trim().replace(/^(['"])(.*)\1$/, '$2')) || undefined;
  } catch {
    return undefined;
  }
}
const name = process.env.PM2_APP || dotenv('PM2_APP') || 'south-street';
const port = process.env.PORT || dotenv('PORT') || 3000;

module.exports = {
  apps: [
    {
      name,
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${port} -H 127.0.0.1`,
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '1G',
      kill_timeout: 8000,
      env: { NODE_ENV: 'production', NEXT_DIST_DIR: distDir },
      out_file: path.join(__dirname, 'logs', 'app.out.log'),
      error_file: path.join(__dirname, 'logs', 'app.err.log'),
      time: true,
    },
    {
      name: `${name}-backup`,
      cwd: __dirname,
      script: 'node_modules/.bin/tsx',
      args: 'scripts/backup-db.ts --reason=auto',
      cron_restart: dotenv('BACKUP_CRON') || '0 3 * * *',
      autorestart: false,
      env: { NODE_ENV: 'production' },
      out_file: path.join(__dirname, 'logs', 'backup.log'),
      error_file: path.join(__dirname, 'logs', 'backup.log'),
      time: true,
    },
    {
      // Official Hajj/Umrah updates for Sakhr: checks nightly, refreshes when ~3 days old.
      name: `${name}-official-updates`,
      cwd: __dirname,
      script: 'node_modules/.bin/tsx',
      args: 'scripts/official-updates.ts refresh --if-due',
      cron_restart: dotenv('OFFICIAL_UPDATES_CRON') || '0 2 * * *',
      autorestart: false,
      env: { NODE_ENV: 'production' },
      out_file: path.join(__dirname, 'logs', 'official-updates.log'),
      error_file: path.join(__dirname, 'logs', 'official-updates.log'),
      time: true,
    },
  ],
};

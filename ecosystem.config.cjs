/**
 * PM2 processes on the VPS (see DEPLOY.md).
 *
 *   south-street         the web app (one process: SQLite has a single writer, and
 *                        login lockouts / presence are kept per process)
 *   south-street-backup  nightly database backup at 03:00 (runs, then exits)
 *
 * NEXT_DIST_DIR is the build folder the app serves; scripts/update.sh builds the
 * next version into the other folder and switches to it with a reload.
 */
const fs = require('fs');
const path = require('path');

const activeFile = path.join(__dirname, '.next-active');
const distDir = process.env.NEXT_DIST_DIR || (fs.existsSync(activeFile) ? fs.readFileSync(activeFile, 'utf8').trim() : '.next');

module.exports = {
  apps: [
    {
      name: 'south-street',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${process.env.PORT || 3000} -H 127.0.0.1`,
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
      name: 'south-street-backup',
      cwd: __dirname,
      script: 'node_modules/.bin/tsx',
      args: 'scripts/backup-db.ts --reason=auto',
      cron_restart: '0 3 * * *',
      autorestart: false,
      env: { NODE_ENV: 'production' },
      out_file: path.join(__dirname, 'logs', 'backup.log'),
      error_file: path.join(__dirname, 'logs', 'backup.log'),
      time: true,
    },
  ],
};

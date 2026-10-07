#!/usr/bin/env node
/**
 * Stops whatever is listening on a port (default 3000), so `npm run start`
 * never fails with EADDRINUSE.
 *
 *   npm run stop            -> frees port 3000
 *   npm run stop -- 3001    -> frees another port
 */
const { execSync } = require('child_process');

const port = Number(process.argv[2] || process.env.PORT || 3000);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`Invalid port: ${process.argv[2]}`);
  process.exit(1);
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function pidsOnPort() {
  if (process.platform === 'win32') {
    // "  TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345"
    return [...new Set(
      run('netstat -ano -p tcp')
        .split(/\r?\n/)
        .filter((line) => /LISTENING/i.test(line))
        .map((line) => line.trim().split(/\s+/))
        .filter((cols) => cols[1] && cols[1].endsWith(`:${port}`))
        .map((cols) => Number(cols[cols.length - 1]))
        .filter((pid) => pid > 0)
    )];
  }
  return [...new Set(run(`lsof -ti tcp:${port} -sTCP:LISTEN`).split(/\s+/).map(Number).filter((pid) => pid > 0))];
}

function processName(pid) {
  if (process.platform === 'win32') {
    const out = run(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`).trim();
    return out.startsWith('"') ? out.split('","')[0].replace(/"/g, '') : 'unknown';
  }
  return run(`ps -p ${pid} -o comm=`).trim() || 'unknown';
}

const pids = pidsOnPort();
if (!pids.length) {
  console.log(`Port ${port} is already free.`);
  process.exit(0);
}

for (const pid of pids) {
  const name = processName(pid);
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
    console.log(`Stopped ${name} (PID ${pid}) on port ${port}.`);
  } catch {
    console.error(`Could not stop ${name} (PID ${pid}). Try running the terminal as administrator.`);
    process.exitCode = 1;
  }
}

if (pidsOnPort().length) {
  console.error(`Port ${port} is still in use.`);
  process.exitCode = 1;
} else {
  console.log(`Port ${port} is free.`);
}

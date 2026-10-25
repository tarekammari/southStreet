/**
 * How the Windows app updates itself — plain functions (no Electron), so they
 * can be tested on their own.
 *
 * Light update (the usual case): the app's own files (resources/app.asar,
 * ~100–200 KB compressed) are downloaded, checked against their SHA-256,
 * and swapped in by a tiny script once the app has closed; then the app
 * starts again. The full installer (~77 MB) is only needed when the Electron
 * runtime itself changes. The ringtones live outside app.asar
 * (resources/sounds), so they never weigh on a light update.
 */
const crypto = require('crypto');
const fs = require('fs');
const zlib = require('zlib');

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Writes a download to disk as it arrives (not all in memory). onProgress(0–100).
 * An incomplete file is dropped. Returns true when the whole file arrived.
 */
async function saveDownload(res, file, onProgress) {
  const total = Number(res.headers.get('content-length')) || 0;
  const part = `${file}.part`;
  const out = fs.createWriteStream(part);
  const reader = res.body.getReader();
  let got = 0;
  let shown = -1;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
      const pct = total ? Math.floor((got * 100) / total) : 0;
      if (pct !== shown) {
        shown = pct;
        onProgress?.(pct);
      }
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    if (total && got !== total) throw new Error('incomplete');
    fs.renameSync(part, file);
    return true;
  } catch {
    out.destroy();
    try { fs.rmSync(part, { force: true }); } catch { /* ignore */ }
    return false;
  }
}

/** Unpacks the downloaded app files (gzip) and keeps them only if their SHA-256 matches. */
function unpackApp(gzFile, outFile, expectedSha256) {
  try {
    fs.writeFileSync(outFile, zlib.gunzipSync(fs.readFileSync(gzFile)));
  } catch {
    return false;
  } finally {
    try { fs.rmSync(gzFile, { force: true }); } catch { /* ignore */ }
  }
  if (!expectedSha256 || sha256(outFile) !== String(expectedSha256).toLowerCase()) {
    try { fs.rmSync(outFile, { force: true }); } catch { /* ignore */ }
    return false;
  }
  return true;
}

/**
 * The script that swaps the app files: waits (up to 60 s) for this app to close,
 * keeps the old files as app.asar.bak, copies the new ones in (retrying while
 * Windows still holds them, up to 30 s) and starts the app again — the old
 * version if the copy never succeeded. UTF-8 (chcp 65001): Arabic user names work.
 * Waits use `ping` (`timeout` quits at once when there is no console, as here).
 */
/** Windows' own tools by full path: another `find` on the PATH (Git, Cygwin…) must not answer. */
const sys = (tool) => `"%SystemRoot%\\System32\\${tool}"`;
const WAIT_1S = `${sys('PING.EXE')} -n 2 127.0.0.1 >nul`;

function applyScript({ pid, newFile, target, exe }) {
  const q = (p) => `"${String(p).replace(/"/g, '')}"`;
  return [
    '@echo off',
    'chcp 65001 >nul',
    `for /l %%i in (1,1,60) do (`,
    `  ${sys('tasklist.exe')} /FI "PID eq ${Number(pid)}" 2>nul | ${sys('find.exe')} "${Number(pid)}" >nul || goto closed`,
    `  ${WAIT_1S}`,
    ')',
    ':closed',
    `copy /y ${q(target)} ${q(`${target}.bak`)} >nul 2>&1`,
    `for /l %%i in (1,1,30) do (`,
    `  copy /y ${q(newFile)} ${q(target)} >nul 2>&1 && goto start`,
    `  ${WAIT_1S}`,
    ')',
    ':start',
    `start "" ${q(exe)}`,
    'del "%~f0"',
    '',
  ].join('\r\n');
}

module.exports = { sha256, saveDownload, unpackApp, applyScript };

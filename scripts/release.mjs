#!/usr/bin/env node
/**
 * Release a new version (run on your PC, after committing your work).
 *
 *   npm run release -- patch          2.1.0 → 2.1.1   fixes only
 *   npm run release -- minor          2.1.0 → 2.2.0   new features
 *   npm run release -- major          2.1.0 → 3.0.0   big / breaking changes
 *   npm run release -- 2.5.0          an exact version
 *   add --push                         also push the commit and the tag to GitHub
 *   add --dry-run                      show what would happen, change nothing
 *
 * It updates package.json + package-lock.json, adds a CHANGELOG.md section built
 * from the commit messages since the last release, commits "release: vX.Y.Z" and
 * creates the tag vX.Y.Z. On the server: ./scripts/update.sh vX.Y.Z
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const args = process.argv.slice(2);
const kind = args.find((a) => !a.startsWith('--'));
const push = args.includes('--push');
const dry = args.includes('--dry-run');

const sh = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

if (!kind) fail('Say which part to raise: patch, minor, major, or an exact version (e.g. 2.5.0).');

const pkgFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
const current = String(pkg.version || '0.0.0');
const m = current.match(/^(\d+)\.(\d+)\.(\d+)/);
if (!m) fail(`Current version "${current}" is not x.y.z`);
let [maj, min, pat] = m.slice(1).map(Number);

let next;
if (kind === 'patch') next = `${maj}.${min}.${pat + 1}`;
else if (kind === 'minor') next = `${maj}.${min + 1}.0`;
else if (kind === 'major') next = `${maj + 1}.0.0`;
else if (/^\d+\.\d+\.\d+$/.test(kind)) next = kind;
else fail(`Unknown "${kind}" — use patch, minor, major or x.y.z`);

const cmp = (a, b) => a.split('.').map(Number).reduce((r, v, i) => r || v - b.split('.').map(Number)[i], 0);
if (cmp(next, current) <= 0) fail(`New version ${next} must be higher than ${current}`);

const tag = `v${next}`;
if (sh('git tag --list').split('\n').includes(tag)) fail(`Tag ${tag} already exists`);
if (sh('git status --porcelain')) {
  if (!dry) fail('There are uncommitted changes. Commit them first, then release.');
  console.log('(note: uncommitted changes — commit them before the real release)');
}

let lastTag = '';
try {
  lastTag = sh('git describe --tags --abbrev=0 --match "v*"');
} catch {
  /* first release */
}
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const subjects = sh(`git log ${range} --pretty=format:%s --no-merges`)
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => s && !/^release: v/i.test(s));
if (lastTag && subjects.length === 0) fail(`No new commits since ${lastTag}.`);

const today = new Date().toISOString().slice(0, 10);
const section = `## ${tag} — ${today}\n\n${(subjects.length ? subjects : ['Initial tracked release']).slice(0, 60).map((s) => `- ${s}`).join('\n')}\n`;

console.log(`\n${current} → ${next}  (${tag})\n\n${section}`);
if (dry) {
  console.log('Dry run: nothing changed.');
  process.exit(0);
}

pkg.version = next;
fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

const lockFile = path.join(root, 'package-lock.json');
if (fs.existsSync(lockFile)) {
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  lock.version = next;
  if (lock.packages?.['']) lock.packages[''].version = next;
  fs.writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
}

const changelogFile = path.join(root, 'CHANGELOG.md');
const header = '# Changelog\n\nEvery release of the South Street app. Newest first.\n\n';
const existing = fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile, 'utf8').replace(/^# Changelog[\s\S]*?\n\n(?=## |$)/, '') : '';
fs.writeFileSync(changelogFile, `${header}${section}\n${existing}`.replace(/\n{3,}/g, '\n\n'));

sh('git add package.json package-lock.json CHANGELOG.md');
sh(`git commit -m "release: ${tag}"`);
sh(`git tag -a ${tag} -m "Release ${tag}"`);
console.log(`✔ Committed and tagged ${tag}.`);

if (push) {
  sh('git push');
  sh('git push --tags');
  console.log('✔ Pushed to GitHub. On the server: ./scripts/update.sh ' + tag);
} else {
  console.log(`Next: git push && git push --tags   — then on the server: ./scripts/update.sh ${tag}`);
}

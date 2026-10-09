/**
 * One-time copy of the local database (south_street.db) into an empty Turso
 * database, so the online app (Vercel) starts with the same hotels, programmes,
 * users and settings. Rows are copied exactly as stored (still encrypted).
 *
 *   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run db:push-turso
 *
 * Refuses to run if the Turso database already has tables, unless --force.
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';

const Libsql = require('libsql');

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
const force = process.argv.includes('--force');
const source = path.resolve(process.env.DB_PATH?.trim() || path.join(process.cwd(), 'south_street.db'));
const CHUNK = 40;

if (!url || !authToken) {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first.');
  process.exit(1);
}

const local = new Database(source, { readonly: true, fileMustExist: true });
const remote = new Libsql(url, { authToken });

type Obj = { type: string; name: string; tbl_name: string; sql: string | null };
const objects = local
  .prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL")
  .all() as Obj[];

const existing = remote.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE 'libsql_%'").get() as { n: number };
if (existing.n > 0 && !force) {
  console.error(`The Turso database already has ${existing.n} tables. Nothing copied (use --force to replace them).`);
  process.exit(1);
}

const tables = objects.filter((o) => o.type === 'table');
const later = objects.filter((o) => o.type !== 'table'); // indexes, triggers, views: after the data

if (force) {
  for (const o of [...later].reverse()) remote.exec(`DROP ${o.type.toUpperCase()} IF EXISTS "${o.name}"`);
  for (const t of tables) remote.exec(`DROP TABLE IF EXISTS "${t.name}"`);
}

let rowsCopied = 0;
for (const t of tables) {
  remote.exec(t.sql!);
  const rows = local.prepare(`SELECT * FROM "${t.name}"`).raw().all() as unknown[][];
  if (rows.length === 0) continue;
  const columns = (local.prepare(`SELECT * FROM "${t.name}" LIMIT 0`).columns() as { name: string }[]).map((c) => `"${c.name}"`);
  const one = `(${columns.map(() => '?').join(', ')})`;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    remote
      .prepare(`INSERT INTO "${t.name}" (${columns.join(', ')}) VALUES ${chunk.map(() => one).join(', ')}`)
      .run(...chunk.flat());
  }
  rowsCopied += rows.length;
  console.log(`  ${t.name}: ${rows.length}`);
}

for (const o of later) remote.exec(o.sql!);

console.log(`\nDone: ${tables.length} tables, ${rowsCopied} rows, ${later.length} indexes/triggers copied to Turso.`);

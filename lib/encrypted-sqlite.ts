import Database from 'better-sqlite3';
import {
  decryptRow,
  decryptValue,
  encodeSqlParams,
  encryptValue,
  isEncryptedValue,
  isLegacyCbcValue,
  parseSqlBindMeta,
  shouldEncryptColumn,
} from './db-crypto';

type Statement = Database.Statement;

function wrapStatement(stmt: Statement, sql: string): Statement {
  const meta = parseSqlBindMeta(sql);
  const origRun = stmt.run.bind(stmt);
  const origGet = stmt.get.bind(stmt);
  const origAll = stmt.all.bind(stmt);

  stmt.run = ((...params: any[]) => origRun(...(encodeSqlParams(meta, params) as any[]))) as typeof stmt.run;
  stmt.get = ((...params: any[]) => {
    const row = origGet(...(encodeSqlParams(meta, params) as any[]));
    return row ? decryptRow(row as Record<string, unknown>) : row;
  }) as typeof stmt.get;
  stmt.all = ((...params: any[]) => {
    const rows = origAll(...(encodeSqlParams(meta, params) as any[])) as Record<string, unknown>[];
    return rows.map((row) => decryptRow(row));
  }) as typeof stmt.all;

  return stmt;
}

export function wrapDatabaseWithEncryption(db: Database.Database): Database.Database {
  if ((db as any).__ssEncrypted) return db;

  const rawPrepare = db.prepare.bind(db);
  (db as any).__rawPrepare = rawPrepare;
  db.prepare = ((sql: string) => wrapStatement(rawPrepare(sql), sql)) as typeof db.prepare;
  (db as any).__ssEncrypted = true;
  return db;
}

export function rawPrepare(db: Database.Database, sql: string): Statement {
  const raw = (db as any).__rawPrepare as typeof db.prepare | undefined;
  return (raw || db.prepare.bind(db))(sql);
}

/** Encrypt leftover plaintext rows from before this layer existed. Safe to run on every boot. */
export function migratePlaintextToEncrypted(db: Database.Database): void {
  const tables = rawPrepare(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all() as { name: string }[];

  for (const { name } of tables) {
    let columns: { name: string }[] = [];
    try {
      columns = rawPrepare(db, `PRAGMA table_info(${name})`).all() as { name: string }[];
    } catch {
      continue;
    }

    const encryptable = columns.filter((c) => shouldEncryptColumn(c.name)).map((c) => c.name);
    if (encryptable.length === 0) continue;

    const pk = columns[0]?.name;
    if (!pk) continue;

    let rows: Record<string, unknown>[] = [];
    try {
      rows = rawPrepare(db, `SELECT * FROM ${name}`).all() as Record<string, unknown>[];
    } catch {
      continue;
    }

    const updateCols = encryptable;
    const sql = `UPDATE ${name} SET ${updateCols.map((c) => `${c} = ?`).join(', ')} WHERE ${pk} = ?`;
    const update = rawPrepare(db, sql);

    const tx = db.transaction(() => {
      for (const row of rows) {
        let changed = false;
        const values: unknown[] = [];
        for (const col of updateCols) {
          const current = row[col];
          if (typeof current === 'string' && current && !isEncryptedValue(current) && !isLegacyCbcValue(current)) {
            values.push(encryptValue(current));
            changed = true;
          } else if (isLegacyCbcValue(current)) {
            values.push(encryptValue(decryptValue(current as string)));
            changed = true;
          } else {
            values.push(current);
          }
        }
        if (!changed) continue;
        update.run(...values, row[pk]);
      }
    });

    try {
      tx();
    } catch (err) {
      console.warn(`[DB Encrypt Migration] ${name}:`, err);
    }
  }
}

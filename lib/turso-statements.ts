/**
 * Work-around for a libsql embedded-replica bug (libsql 0.5): a statement
 * prepared outside a transaction and then run inside one (or the reverse) fails
 * with `InvalidParserState("Init")`. The app does this in several places, e.g.
 * recovery codes and seeds, which works with a local SQLite file.
 *
 * Every statement keeps working as before, but when the transaction state has
 * changed since it was prepared it is transparently prepared again.
 */
type Stmt = Record<string | symbol, any>;
type Db = { prepare(sql: string): Stmt; inTransaction: boolean };

export function reprepareAcrossTransactions<T extends Db>(db: T): T {
  const nativePrepare = db.prepare.bind(db);
  db.prepare = ((sql: string) => {
    const first = nativePrepare(sql);
    const preparedInTx = db.inTransaction;
    let rawMode: boolean | undefined;
    let pluckMode: boolean | undefined;
    const current = (): Stmt => {
      if (db.inTransaction === preparedInTx) return first;
      const fresh = nativePrepare(sql);
      if (rawMode !== undefined) fresh.raw(rawMode);
      if (pluckMode !== undefined) fresh.pluck(pluckMode);
      return fresh;
    };
    const proxy: Stmt = new Proxy(first, {
      get(target, prop) {
        if (prop === 'run' || prop === 'get' || prop === 'all' || prop === 'iterate') {
          // A layer above (the column encryption) may have replaced the method:
          // callers get that, and it in turn reaches the native method below.
          if (Object.prototype.hasOwnProperty.call(target, prop)) return target[prop];
          return (...args: unknown[]) => {
            const stmt = current();
            return Object.getPrototypeOf(stmt)[prop].apply(stmt, args);
          };
        }
        if (prop === 'raw') return (on?: boolean) => { rawMode = on ?? true; target.raw(on); return proxy; };
        if (prop === 'pluck') return (on?: boolean) => { pluckMode = on ?? true; target.pluck(on); return proxy; };
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    return proxy;
  }) as T['prepare'];
  return db;
}

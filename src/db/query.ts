/**
 * Query helpers: supports both Neon (Postgres $1,$2) and sql.js (? placeholders).
 */

function toPgParams(sql: string, params: unknown[]): [string, unknown[]] {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  return [pgSql, params];
}

/** For INSERT ... RETURNING id - returns the first row. */
export async function runReturning<T = Record<string, unknown>>(
  db: unknown,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  if (typeof (db as { query?: unknown }).query === "function") {
    const [pgSql, pgParams] = toPgParams(sql, params);
    const rows = await (db as { query: (s: string, p?: unknown[]) => Promise<unknown[]> }).query(
      pgSql,
      pgParams
    );
    return (Array.isArray(rows) && rows[0]) as T | null;
  }
  const stmt = (db as { prepare: (s: string) => { bind: (p: unknown[]) => void; step: () => boolean; get: () => unknown; free: () => void } }).prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.get() : null;
  stmt.free();
  return row as T | null;
}

export async function run(
  db: unknown,
  sql: string,
  params: unknown[] = []
): Promise<void> {
  if (typeof (db as { query?: unknown }).query === "function") {
    const [pgSql, pgParams] = toPgParams(sql, params);
    await (db as { query: (s: string, p?: unknown[]) => Promise<unknown> }).query(
      pgSql,
      pgParams
    );
    return;
  }
  const stmt = (db as { prepare: (s: string) => { bind: (p: unknown[]) => void; step: () => boolean; free: () => void } }).prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
}

export async function get<T = unknown>(
  db: unknown,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  if (typeof (db as { query?: unknown }).query === "function") {
    const [pgSql, pgParams] = toPgParams(sql, params);
    const rows = await (db as { query: (s: string, p?: unknown[]) => Promise<unknown[]> }).query(
      pgSql,
      pgParams
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    return row as T | null;
  }
  const stmt = (db as { prepare: (s: string) => { bind: (p: unknown[]) => void; step: () => boolean; get: () => unknown; free: () => void } }).prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? (stmt.get() as T) : null;
  stmt.free();
  return row;
}

export async function all<T = unknown[]>(
  db: unknown,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (typeof (db as { query?: unknown }).query === "function") {
    const [pgSql, pgParams] = toPgParams(sql, params);
    const rows = await (db as { query: (s: string, p?: unknown[]) => Promise<unknown[]> }).query(
      pgSql,
      pgParams
    );
    return (Array.isArray(rows) ? rows : []) as T[];
  }
  const stmt = (db as { prepare: (s: string) => { bind: (p: unknown[]) => void; step: () => boolean; get: () => unknown; free: () => void } }).prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.get() as T);
  stmt.free();
  return rows;
}

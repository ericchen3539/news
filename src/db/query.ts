/**
 * Query helpers for sql.js with parameterized statements.
 */

import type { Database } from "sql.js";

export function run(db: Database, sql: string, params: unknown[] = []): void {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
}

export function get<T = unknown>(db: Database, sql: string, params: unknown[] = []): T | null {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? (stmt.get() as T) : null;
  stmt.free();
  return row;
}

export function all<T = unknown[]>(db: Database, sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.get() as T);
  stmt.free();
  return rows;
}

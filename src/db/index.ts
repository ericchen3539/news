/**
 * Database layer using sql.js.
 * Provides a synchronous-style API and persists to file.
 */

import initSqlJs, { type Database } from "sql.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database | null = null;

const getDbPath = (): string => {
  const url = process.env.DATABASE_URL ?? "file:./data/news.db";
  const match = url.match(/^file:(.+)$/);
  return match ? join(process.cwd(), match[1]) : join(process.cwd(), "data", "news.db");
};

export async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: (file: string) => join(__dirname, "../../node_modules/sql.js/dist", file),
  });

  const dbPath = getDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  return db;
}

export function saveDb(): void {
  if (!db) return;
  const dbPath = getDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
}

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

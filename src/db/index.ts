/**
 * Database layer: Neon Postgres when DATABASE_URL is postgres(ql)://, else sql.js for local file.
 */

const dbUrl = process.env.DATABASE_URL ?? "file:./data/news.db";
const useNeon =
  dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

let sqlNeon: ReturnType<typeof import("@neondatabase/serverless").neon> | null =
  null;

export async function getDb(): Promise<
  | ReturnType<typeof import("@neondatabase/serverless").neon>
  | import("sql.js").Database
> {
  if (process.env.VERCEL === "1" && !useNeon) {
    throw new Error(
      "Vercel requires DATABASE_URL with postgresql://. Set it in Vercel project settings."
    );
  }
  if (useNeon) {
    if (!sqlNeon) {
      const { neon } = await import("@neondatabase/serverless");
      sqlNeon = neon(dbUrl);
      const { SCHEMA_PG_STATEMENTS } = await import("./schema-pg.js");
      for (const stmt of SCHEMA_PG_STATEMENTS) {
        await sqlNeon.query(stmt);
      }
    }
    return sqlNeon;
  }

  const initSqlJs = (await import("sql.js")).default;
  const { readFileSync, writeFileSync, mkdirSync, existsSync } = await import(
    "fs"
  );
  const { dirname, join } = await import("path");
  const { fileURLToPath } = await import("url");
  const { SCHEMA } = await import("./schema.js");

  const __dirname = dirname(fileURLToPath(import.meta.url));
  let db = (globalThis as { __sqliteDb?: import("sql.js").Database }).__sqliteDb;

  if (!db) {
    const SQL = await initSqlJs({
      locateFile: (file: string) =>
        join(__dirname, "../../node_modules/sql.js/dist", file),
    });

    const getDbPath = (): string => {
      const match = dbUrl.match(/^file:(.+)$/);
      const path = match ? match[1] : "./data/news.db";
      return join(process.cwd(), path.startsWith("/") ? path.slice(1) : path);
    };

    const dbPath = getDbPath();
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    if (existsSync(dbPath)) {
      const buffer = readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
      db.run(SCHEMA);
    }
    (globalThis as { __sqliteDb?: import("sql.js").Database }).__sqliteDb = db;
  }

  return db;
}

import { createRequire } from "module";
const require = createRequire(import.meta.url);

export function saveDb(): void {
  const db = (globalThis as { __sqliteDb?: import("sql.js").Database }).__sqliteDb;
  if (!db || useNeon) return;

  const { writeFileSync, mkdirSync, existsSync } = require("fs");
  const { dirname, join } = require("path");
  const getDbPath = (): string => {
    const match = dbUrl.match(/^file:(.+)$/);
    const path = match ? match[1] : "./data/news.db";
    return join(process.cwd(), path.startsWith("/") ? path.slice(1) : path);
  };
  const dbPath = getDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
}

export function closeDb(): void {
  if (useNeon) {
    sqlNeon = null;
    return;
  }
  const db = (globalThis as { __sqliteDb?: import("sql.js").Database }).__sqliteDb;
  if (db) {
    saveDb();
    db.close();
    (globalThis as { __sqliteDb?: import("sql.js").Database }).__sqliteDb =
      undefined;
  }
}

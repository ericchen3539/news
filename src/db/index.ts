/**
 * Database layer: Neon Postgres when DATABASE_URL is postgres(ql)://, else sql.js for local file.
 * For Vercel + Neon: use pooled connection string (host contains -pooler) to reduce "fetch failed" errors.
 */

const dbUrl = process.env.DATABASE_URL ?? "file:./data/news.db";
const useNeon =
  dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

const NEON_RETRY_ATTEMPTS = 3;
const NEON_RETRY_DELAY_MS = 600;

function isNeonRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const causeMsg = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
  return (
    msg.includes("fetch failed") ||
    msg.includes("other side closed") ||
    msg.includes("UND_ERR_SOCKET") ||
    causeMsg.includes("other side closed")
  );
}

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
      for (let attempt = 1; attempt <= NEON_RETRY_ATTEMPTS; attempt++) {
        try {
          const { neon } = await import("@neondatabase/serverless");
          sqlNeon = neon(dbUrl);
          const { SCHEMA_PG_STATEMENTS } = await import("./schema-pg.js");
          for (const stmt of SCHEMA_PG_STATEMENTS) {
            await sqlNeon.query(stmt);
          }
          break;
        } catch (err) {
          sqlNeon = null;
          if (!isNeonRetryableError(err) || attempt === NEON_RETRY_ATTEMPTS) {
            throw err;
          }
          console.warn(`[Db] Neon connection attempt ${attempt} failed, retrying:`, err instanceof Error ? err.message : err);
          await new Promise((r) => setTimeout(r, NEON_RETRY_DELAY_MS * attempt));
        }
      }
    }
    if (!sqlNeon) throw new Error("Neon connection failed after retries");
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

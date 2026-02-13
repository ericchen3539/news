/**
 * Run database migrations.
 * Uses Postgres schema when DATABASE_URL is postgres(ql)://, else SQLite schema.
 */

import { getDb, saveDb } from "./index.js";
import { SCHEMA } from "./schema.js";
import { SCHEMA_PG } from "./schema-pg.js";

const dbUrl = process.env.DATABASE_URL ?? "file:./data/news.db";
const useNeon =
  dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

async function migrate() {
  const db = await getDb();
  if (typeof (db as { query?: unknown }).query === "function") {
    await (db as { query: (s: string) => Promise<unknown> }).query(SCHEMA_PG);
  } else {
    (db as { run: (s: string) => void }).run(SCHEMA);
    saveDb();
  }
  console.log("Migration complete.");
}

migrate().catch(console.error);

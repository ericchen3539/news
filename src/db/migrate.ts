/**
 * Run database migrations.
 * Uses Postgres schema when DATABASE_URL is postgres(ql)://, else SQLite schema.
 */

import { getDb, saveDb } from "./index.js";
import { SCHEMA } from "./schema.js";
import { SCHEMA_PG_STATEMENTS } from "./schema-pg.js";

const dbUrl = process.env.DATABASE_URL ?? "file:./data/news.db";
const useNeon =
  dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

async function migrate() {
  const db = await getDb();
  if (typeof (db as { query?: unknown }).query === "function") {
    for (const stmt of SCHEMA_PG_STATEMENTS) {
      await (db as { query: (s: string) => Promise<unknown> }).query(stmt);
    }
    await (db as { query: (s: string) => Promise<unknown> }).query(
      "ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS content TEXT"
    );
  } else {
    (db as { run: (s: string) => void }).run(SCHEMA);
    saveDb();
    try {
      (db as { run: (s: string) => void }).run("ALTER TABLE sent_emails ADD COLUMN content TEXT");
      saveDb();
    } catch (err) {
      if (!String(err).includes("duplicate column")) throw err;
    }
  }
  console.log("Migration complete.");
}

migrate().catch(console.error);

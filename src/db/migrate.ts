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
  const isPg = typeof (db as { query?: unknown }).query === "function";
  if (isPg) {
    for (const stmt of SCHEMA_PG_STATEMENTS) {
      await (db as { query: (s: string) => Promise<unknown> }).query(stmt);
    }
    await (db as { query: (s: string) => Promise<unknown> }).query(
      "ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS content TEXT"
    );
    try {
      await (db as { query: (s: string) => Promise<unknown> }).query(
        "ALTER TABLE user_schedules ADD COLUMN frequency_hours INTEGER DEFAULT 24"
      );
    } catch (err) {
      if (!String(err).includes("already exists") && !String(err).includes("duplicate column")) throw err;
    }
    try {
      await (db as { query: (s: string) => Promise<unknown> }).query(
        `UPDATE user_schedules SET frequency_hours = COALESCE(frequency_days, 1) * 24
         WHERE frequency_hours IS NULL OR frequency_hours = 0`
      );
    } catch {
      // Fallback: migrate from frequency enum
      await (db as { query: (s: string) => Promise<unknown> }).query(
        `UPDATE user_schedules SET frequency_hours = CASE frequency
          WHEN 'daily' THEN 24 WHEN 'weekly' THEN 168 WHEN 'biweekly' THEN 336 WHEN 'monthly' THEN 720
          ELSE 24 END WHERE frequency_hours IS NULL OR frequency_hours = 0`
      ).catch(() => {});
    }
  } else {
    (db as { run: (s: string) => void }).run(SCHEMA);
    saveDb();
    try {
      (db as { run: (s: string) => void }).run("ALTER TABLE sent_emails ADD COLUMN content TEXT");
      saveDb();
    } catch (err) {
      if (!String(err).includes("duplicate column")) throw err;
    }
    try {
      (db as { run: (s: string) => void }).run("ALTER TABLE user_schedules ADD COLUMN frequency_hours INTEGER DEFAULT 24");
      saveDb();
    } catch (err) {
      if (!String(err).includes("duplicate column")) throw err;
    }
    try {
      (db as { run: (s: string) => void }).run(
        `UPDATE user_schedules SET frequency_hours = COALESCE(frequency_days, 1) * 24
         WHERE frequency_hours IS NULL OR frequency_hours = 0`
      );
      saveDb();
    } catch {
      try {
        (db as { run: (s: string) => void }).run(
          `UPDATE user_schedules SET frequency_hours = CASE frequency
            WHEN 'daily' THEN 24 WHEN 'weekly' THEN 168 WHEN 'biweekly' THEN 336 WHEN 'monthly' THEN 720
            ELSE 24 END WHERE frequency_hours IS NULL OR frequency_hours = 0`
        );
        saveDb();
      } catch {
        // Old schema may not have frequency column
      }
    }
  }
  console.log("Migration complete.");
}

migrate().catch(console.error);

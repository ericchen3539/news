/**
 * Run database migrations.
 */

import { getDb, saveDb } from "./index.js";
import { SCHEMA } from "./schema.js";

async function migrate() {
  const db = await getDb();
  db.run(SCHEMA);
  saveDb();
  console.log("Migration complete.");
}

migrate().catch(console.error);

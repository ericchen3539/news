/**
 * Log sent emails for user query. Called after successful send only.
 */

import { getDb, saveDb } from "../db/index.js";
import { run } from "../db/query.js";

export type SentEmailType = "verification" | "digest";

export async function logSentEmail(
  userId: number,
  type: SentEmailType,
  subject: string
): Promise<void> {
  const db = await getDb();
  const sentAt = Math.floor(Date.now() / 1000);
  await run(db, "INSERT INTO sent_emails (user_id, type, subject, sent_at) VALUES (?, ?, ?, ?)", [
    userId,
    type,
    subject,
    sentAt,
  ]);
  saveDb();
}

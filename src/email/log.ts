/**
 * Log sent emails for user query. Called after successful send only.
 * For digest: trigger='cron' = scheduled, trigger='manual' = send-now. Manual sends do not affect cron interval.
 */

import { getDb, saveDb } from "../db/index.js";
import { run } from "../db/query.js";

export type SentEmailType = "verification" | "digest";
export type DigestTrigger = "cron" | "manual";

export async function logSentEmail(
  userId: number,
  type: SentEmailType,
  subject: string,
  content?: string,
  trigger?: DigestTrigger
): Promise<void> {
  const db = await getDb();
  const sentAt = Math.floor(Date.now() / 1000);
  if (type === "digest" && trigger != null) {
    await run(
      db,
      "INSERT INTO sent_emails (user_id, type, subject, content, sent_at, digest_trigger) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, type, subject, content ?? null, sentAt, trigger]
    );
  } else {
    await run(
      db,
      "INSERT INTO sent_emails (user_id, type, subject, content, sent_at) VALUES (?, ?, ?, ?, ?)",
      [userId, type, subject, content ?? null, sentAt]
    );
  }
  saveDb();
}

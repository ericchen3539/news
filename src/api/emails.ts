/**
 * Email history API - returns sent emails for the authenticated user.
 */

import { Router } from "express";
import { getDb } from "../db/index.js";
import { all } from "../db/query.js";
import { requireAuth } from "./middleware.js";

const MAX_EMAILS = 100;

export const emailsRouter = Router();
emailsRouter.use(requireAuth);

emailsRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const db = await getDb();
  const rows = await all<
    [string, string, number, string | null] | { type: string; subject: string; sent_at: number; content: string | null }
  >(
    db,
    "SELECT type, subject, sent_at, content FROM sent_emails WHERE user_id = ? ORDER BY sent_at DESC LIMIT ?",
    [userId, MAX_EMAILS]
  );
  const emails = rows.map((r) =>
    Array.isArray(r)
      ? { type: r[0], subject: r[1], sent_at: r[2], content: r[3] ?? null }
      : { type: r.type, subject: r.subject, sent_at: r.sent_at, content: r.content ?? null }
  );
  res.json({ emails });
});

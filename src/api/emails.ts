/**
 * Email history API - returns sent emails for the authenticated user.
 * Supports listing and permanent deletion.
 */

import { Router } from "express";
import { getDb, saveDb } from "../db/index.js";
import { all, run } from "../db/query.js";
import { requireAuth } from "./middleware.js";

const MAX_EMAILS = 100;

export const emailsRouter = Router();
emailsRouter.use(requireAuth);

emailsRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const db = await getDb();
  const rows = await all<
    [number, string, string, number, string | null] | { id: number; type: string; subject: string; sent_at: number; content: string | null }
  >(
    db,
    "SELECT id, type, subject, sent_at, content FROM sent_emails WHERE user_id = ? ORDER BY sent_at DESC LIMIT ?",
    [userId, MAX_EMAILS]
  );
  const emails = rows.map((r) =>
    Array.isArray(r)
      ? { id: r[0], type: r[1], subject: r[2], sent_at: r[3], content: r[4] ?? null }
      : { id: r.id, type: r.type, subject: r.subject, sent_at: r.sent_at, content: r.content ?? null }
  );
  res.json({ emails });
});

emailsRouter.delete("/:id", async (req, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const db = await getDb();
  await run(db, "DELETE FROM sent_emails WHERE id = ? AND user_id = ?", [id, userId]);
  saveDb();
  res.json({ deleted: true });
});

emailsRouter.post("/batch-delete", async (req, res) => {
  const userId = req.userId!;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x: unknown) => parseInt(String(x), 10)).filter((n: number) => !isNaN(n)) : [];
  if (ids.length === 0) {
    res.status(400).json({ error: "ids required" });
    return;
  }
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(",");
  await run(db, `DELETE FROM sent_emails WHERE id IN (${placeholders}) AND user_id = ?`, [...ids, userId]);
  saveDb();
  res.json({ deleted: ids.length });
});

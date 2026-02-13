/**
 * User news sources CRUD.
 */

import { Router } from "express";
import { getDb, saveDb } from "../db/index.js";
import { run, runReturning, all } from "../db/query.js";
import { requireAuth } from "./middleware.js";

export const sourcesRouter = Router();
sourcesRouter.use(requireAuth);

sourcesRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const db = await getDb();
  const rows = await all<[number, string, string] | { id: number; source_url: string; label: string }>(
    db,
    "SELECT id, source_url, label FROM user_sources WHERE user_id = ? ORDER BY id",
    [userId]
  );
  res.json(
    rows.map((r) =>
      Array.isArray(r)
        ? { id: r[0], source_url: r[1], label: r[2] }
        : { id: r.id, source_url: r.source_url, label: r.label }
    )
  );
});

sourcesRouter.post("/", async (req, res) => {
  const userId = req.userId!;
  const { source_url, label } = req.body ?? {};
  if (!source_url) {
    res.status(400).json({ error: "网站地址必填" });
    return;
  }
  const displayLabel =
    (typeof label === "string" && label.trim()) ||
    (() => {
      try {
        return new URL(source_url).hostname.replace(/^www\./, "") || source_url;
      } catch {
        return source_url;
      }
    })();
  const db = await getDb();
  const row = await runReturning<[number] | { id: number }>(
    db,
    "INSERT INTO user_sources (user_id, source_url, label) VALUES (?, ?, ?) RETURNING id",
    [userId, source_url.trim(), displayLabel]
  );
  const id = Array.isArray(row) ? row?.[0] : row?.id;
  saveDb();
  res.status(201).json({ id, source_url: source_url.trim(), label: displayLabel });
});

sourcesRouter.delete("/:id", async (req, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const db = await getDb();
  await run(db, "DELETE FROM user_sources WHERE id = ? AND user_id = ?", [id, userId]);
  saveDb();
  res.json({ deleted: true });
});

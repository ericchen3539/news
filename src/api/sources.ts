/**
 * User news sources CRUD.
 */

import { Router } from "express";
import { getDb, saveDb } from "../db/index.js";
import { run, get, all } from "../db/query.js";
import { requireAuth } from "./middleware.js";

export const sourcesRouter = Router();
sourcesRouter.use(requireAuth);

sourcesRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const db = await getDb();
  const rows = all<[number, string, string]>(
    db,
    "SELECT id, source_url, label FROM user_sources WHERE user_id = ? ORDER BY id",
    [userId]
  );
  res.json(
    rows.map(([id, source_url, label]) => ({ id, source_url, label }))
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
  run(db, "INSERT INTO user_sources (user_id, source_url, label) VALUES (?, ?, ?)", [
    userId,
    source_url.trim(),
    displayLabel,
  ]);
  saveDb();
  const row = get<[number]>(db, "SELECT last_insert_rowid()");
  res.status(201).json({ id: row?.[0], source_url: source_url.trim(), label: displayLabel });
});

sourcesRouter.delete("/:id", async (req, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const db = await getDb();
  run(db, "DELETE FROM user_sources WHERE id = ? AND user_id = ?", [id, userId]);
  saveDb();
  res.json({ deleted: true });
});

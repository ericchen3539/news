/**
 * User news sources CRUD.
 * Accepts website URLs; discovers and stores full RSS feed URLs.
 */

import { Router } from "express";
import { getDb, saveDb } from "../db/index.js";
import { run, runReturning, all } from "../db/query.js";
import { requireAuth } from "./middleware.js";
import { discoverRssFeed } from "../fetcher/discover.js";

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
  const userInput = typeof source_url === "string" ? source_url.trim() : "";
  if (!userInput) {
    res.status(400).json({ error: "网站地址必填" });
    return;
  }

  const feedUrl = await discoverRssFeed(userInput);
  if (!feedUrl) {
    res.status(400).json({
      error: "无法从该地址发现 RSS 源，请确认网站支持 RSS 或提供完整的 RSS 链接",
    });
    return;
  }

  const displayLabel =
    (typeof label === "string" && label.trim()) ||
    (() => {
      try {
        return new URL(feedUrl).hostname.replace(/^www\./, "") || feedUrl;
      } catch {
        return feedUrl;
      }
    })();

  const db = await getDb();
  const row = await runReturning<[number] | { id: number }>(
    db,
    "INSERT INTO user_sources (user_id, source_url, label) VALUES (?, ?, ?) RETURNING id",
    [userId, feedUrl, displayLabel]
  );
  const id = Array.isArray(row) ? row?.[0] : row?.id;
  saveDb();
  res.status(201).json({ id, source_url: feedUrl, label: displayLabel });
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

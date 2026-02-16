/**
 * News cache: per-user fetched items. Written by 8h fetch job, read at send time.
 */

import type { NewsItem } from "../fetcher/index.js";
import { saveDb } from "./index.js";
import { run, all, get } from "./query.js";

type Db = Awaited<ReturnType<typeof import("./index.js").getDb>>;

/** Upsert items into news_cache for a user. Uses INSERT OR REPLACE / ON CONFLICT. */
export async function upsertNewsCache(
  db: Db,
  userId: number,
  items: NewsItem[]
): Promise<void> {
  const isPg = typeof (db as { query?: unknown }).query === "function";
  const now = Math.floor(Date.now() / 1000);

  for (const item of items) {
    if (!item.link) continue;
    const pubDate = item.pubDate ? Math.floor(item.pubDate / 1000) : now;
    const title = (item.title ?? "").slice(0, 4096);
    const summary = (item.summary ?? "").slice(0, 16384);
    const sourceUrl = (item.sourceUrl ?? "").slice(0, 2048);
    const sourceLabel = (item.sourceLabel ?? "").slice(0, 256);

    if (isPg) {
      await (db as { query: (s: string, p?: unknown[]) => Promise<unknown> }).query(
        `INSERT INTO news_cache (user_id, link, title, summary, source_url, source_label, pub_date, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, link) DO UPDATE SET
           title = EXCLUDED.title,
           summary = EXCLUDED.summary,
           source_url = EXCLUDED.source_url,
           source_label = EXCLUDED.source_label,
           pub_date = EXCLUDED.pub_date,
           fetched_at = EXCLUDED.fetched_at`,
        [userId, item.link, title, summary, sourceUrl, sourceLabel, pubDate, now]
      );
    } else {
      await run(
        db,
        `INSERT OR REPLACE INTO news_cache (user_id, link, title, summary, source_url, source_label, pub_date, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, item.link, title, summary, sourceUrl, sourceLabel, pubDate, now]
      );
    }
  }

  if (!isPg) saveDb();
}

/**
 * Returns the most recent fetched_at (unix seconds) for a user's cache, or 0 if empty.
 */
export async function getMostRecentFetchedAt(db: Db, userId: number): Promise<number> {
  const row = await get<[number] | { max_fetched: number }>(
    db,
    "SELECT MAX(fetched_at) AS max_fetched FROM news_cache WHERE user_id = ?",
    [userId]
  );
  if (!row) return 0;
  const val = Array.isArray(row) ? row[0] : (row as { max_fetched: number }).max_fetched;
  return typeof val === "number" && !Number.isNaN(val) ? val : 0;
}

/** Fetch cached items for a user within the given time window (hours). Always uses full window. */
export async function getCachedNews(
  db: Db,
  userId: number,
  fetchWindowHours: number
): Promise<NewsItem[]> {
  const cutoffSec =
    fetchWindowHours > 0
      ? Math.floor((Date.now() - fetchWindowHours * 3600 * 1000) / 1000)
      : 0;

  const rows = await all<[string, string, string, string] | { link: string; title: string; summary: string; source_label: string }>(
    db,
    "SELECT link, title, summary, source_label FROM news_cache WHERE user_id = ? AND pub_date >= ? ORDER BY pub_date DESC",
    [userId, cutoffSec]
  );

  return rows.map((r) => {
    const link = Array.isArray(r) ? r[0] : r.link;
    const title = Array.isArray(r) ? r[1] : r.title;
    const summary = Array.isArray(r) ? r[2] : r.summary;
    const sourceLabel = Array.isArray(r) ? r[3] : r.source_label;
    return { title: title ?? "", summary: summary ?? "", link: link ?? "", sourceLabel: sourceLabel ?? "" };
  });
}

/** Delete cached items older than the given cutoff (unix seconds). */
export async function cleanupExpiredCache(db: Db, cutoffSec: number): Promise<void> {
  const isPg = typeof (db as { query?: unknown }).query === "function";
  if (isPg) {
    await (db as { query: (s: string, p: unknown[]) => Promise<unknown> }).query(
      "DELETE FROM news_cache WHERE pub_date < $1",
      [cutoffSec]
    );
  } else {
    await run(db, "DELETE FROM news_cache WHERE pub_date < ?", [cutoffSec]);
    saveDb();
  }
}

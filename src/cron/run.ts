/**
 * Cron job - runs every minute, checks which users should receive digest, fetches, filters, translates, sends.
 */

import cron from "node-cron";
import { getDb, saveDb } from "../db/index.js";
import { all, get } from "../db/query.js";
import { upsertNewsCache, getCachedNews, getMostRecentFetchedAt, cleanupExpiredCache } from "../db/cache.js";
import { fetchAndMerge } from "../fetcher/index.js";
import { filterNews } from "../filter/engine.js";
import { translateBatch } from "../translate/index.js";
import { buildDigestTable } from "../email/template.js";
import { sendDigestEmail } from "../email/send.js";
import { logSentEmail } from "../email/log.js";

export interface UserToNotify {
  userId: number;
  email: string;
  sources: { source_url: string; label: string }[];
  mode: "include" | "exclude";
  categories: string[];
  fetchWindowHours: number;
  /** Unix seconds of last digest sent; 0 = never sent. Used for schedule logic only (elapsedSec >= minIntervalSec). */
  lastSentAt?: number;
}

function rowToUser(r: [number, string] | { id: number; email: string }): [number, string] {
  return Array.isArray(r) ? r : [r.id, r.email];
}

function rowToSource(r: [string, string] | { source_url: string; label: string }): [string, string] {
  return Array.isArray(r) ? r : [r.source_url, r.label];
}

export async function getUsersToNotify(): Promise<UserToNotify[]> {
  const db = await getDb();

  const users = await all<[number, string] | { id: number; email: string }>(
    db,
    "SELECT id, email FROM users WHERE verified_at IS NOT NULL"
  );
  const result: UserToNotify[] = [];

  for (const userRow of users) {
    const [userId, email] = rowToUser(userRow);
    const sourcesRows = await all<[string, string] | { source_url: string; label: string }>(
      db,
      "SELECT source_url, label FROM user_sources WHERE user_id = ?",
      [userId]
    );
    if (sourcesRows.length === 0) continue;

    const filterRow = await get<[string, string] | { mode: string; categories_json: string }>(
      db,
      "SELECT mode, categories_json FROM user_filters WHERE user_id = ?",
      [userId]
    );
    const modeVal = Array.isArray(filterRow) ? filterRow?.[0] : filterRow?.mode;
    const mode = (modeVal as "include" | "exclude") ?? "include";
    let categories: string[] = [];
    try {
      const catJson = Array.isArray(filterRow) ? filterRow?.[1] : filterRow?.categories_json;
      categories = JSON.parse(catJson ?? "[]") ?? [];
    } catch {
      // ignore
    }

    const scheduleRow = await get<
      [number, string, string] | {
        frequency_hours: number;
        send_time: string;
        timezone: string;
      }
    >(
      db,
      "SELECT COALESCE(frequency_hours, 24), send_time, timezone FROM user_schedules WHERE user_id = ?",
      [userId]
    );
    const frequencyHours = (Array.isArray(scheduleRow) ? scheduleRow?.[0] : scheduleRow?.frequency_hours) ?? 24;
    const sendTime = (Array.isArray(scheduleRow) ? scheduleRow?.[1] : scheduleRow?.send_time) ?? "06:00";
    const timezone = (Array.isArray(scheduleRow) ? scheduleRow?.[2] : scheduleRow?.timezone) ?? "Asia/Shanghai";
    const fetchWindowHours = frequencyHours;

    const [h, m] = sendTime.split(":").map(Number);
    const userDate = new Date(
      new Date().toLocaleString("en-US", { timeZone: timezone })
    );
    const userHour = userDate.getHours();
    const userMin = userDate.getMinutes();
    const currentMinutes = userHour * 60 + userMin;
    const sendBaseMinutes = (h ?? 0) * 60 + (m ?? 0);
    const intervalMinutes = frequencyHours * 60;
    const isSendMoment =
      frequencyHours >= 24
        ? userHour === h && userMin === m
        : ((currentMinutes - sendBaseMinutes + 24 * 60) % intervalMinutes) < 2;

    const lastDigestRow = await get<[number] | { sent_at: number }>(
      db,
      "SELECT sent_at FROM sent_emails WHERE user_id = ? AND type = 'digest' ORDER BY sent_at DESC LIMIT 1",
      [userId]
    );
    const lastSentAt = lastDigestRow
      ? (Array.isArray(lastDigestRow) ? lastDigestRow[0] : lastDigestRow.sent_at)
      : 0;
    const minIntervalSec = frequencyHours * 3600;
    const elapsedSec = Math.floor(Date.now() / 1000) - lastSentAt;
    const shouldSend = isSendMoment && (lastSentAt === 0 || elapsedSec >= minIntervalSec);

    if (shouldSend) {
      result.push({
        userId,
        email,
        sources: sourcesRows.map((r) => {
          const [source_url, label] = rowToSource(r);
          return { source_url, label };
        }),
        mode,
        categories,
        fetchWindowHours,
        lastSentAt,
      });
    }
  }

  return result;
}

/** All verified users with at least one source (for 8h fetch task). Includes fetchWindowHours for cache scope. */
export async function getUsersWithSources(): Promise<{ userId: number; sources: { source_url: string; label: string }[]; fetchWindowHours: number }[]> {
  const db = await getDb();
  const users = await all<[number] | { id: number }>(
    db,
    "SELECT id FROM users WHERE verified_at IS NOT NULL"
  );
  const result: { userId: number; sources: { source_url: string; label: string }[]; fetchWindowHours: number }[] = [];
  for (const u of users) {
    const userId = Array.isArray(u) ? u[0] : u.id;
    const sourcesRows = await all<[string, string] | { source_url: string; label: string }>(
      db,
      "SELECT source_url, label FROM user_sources WHERE user_id = ?",
      [userId]
    );
    if (sourcesRows.length === 0) continue;
    const scheduleRow = await get<[number] | { frequency_hours: number }>(
      db,
      "SELECT COALESCE(frequency_hours, 24) FROM user_schedules WHERE user_id = ?",
      [userId]
    );
    const fetchWindowHours = (Array.isArray(scheduleRow) ? scheduleRow?.[0] : scheduleRow?.frequency_hours) ?? 24;
    result.push({
      userId,
      sources: sourcesRows.map((r) => {
        const [source_url, label] = rowToSource(r);
        return { source_url, label };
      }),
      fetchWindowHours,
    });
  }
  return result;
}

/**
 * Fetches a single user's digest config (bypasses schedule check).
 * Used by dev send-digest-now endpoint.
 */
export async function getUserForDigest(userId: number): Promise<UserToNotify | null> {
  const db = await getDb();

  const userRow = await get<[number, string] | { id: number; email: string }>(
    db,
    "SELECT id, email FROM users WHERE id = ? AND verified_at IS NOT NULL",
    [userId]
  );
  if (!userRow) return null;

  const [uid, email] = rowToUser(userRow);

  const sourcesRows = await all<[string, string] | { source_url: string; label: string }>(
    db,
    "SELECT source_url, label FROM user_sources WHERE user_id = ?",
    [uid]
  );
  if (sourcesRows.length === 0) return null;

  const filterRow = await get<[string, string] | { mode: string; categories_json: string }>(
    db,
    "SELECT mode, categories_json FROM user_filters WHERE user_id = ?",
    [uid]
  );
  const modeVal = Array.isArray(filterRow) ? filterRow?.[0] : filterRow?.mode;
  const mode = (modeVal as "include" | "exclude") ?? "include";
  let categories: string[] = [];
  try {
    const catJson = Array.isArray(filterRow) ? filterRow?.[1] : filterRow?.categories_json;
    categories = JSON.parse(catJson ?? "[]") ?? [];
  } catch {
    // ignore
  }

  const scheduleRow = await get<
    [number] | { frequency_hours: number }
  >(
    db,
    "SELECT COALESCE(frequency_hours, 24) FROM user_schedules WHERE user_id = ?",
    [uid]
  );
  const frequencyHours = (Array.isArray(scheduleRow) ? scheduleRow?.[0] : scheduleRow?.frequency_hours) ?? 24;
  const fetchWindowHours = frequencyHours;

  const lastDigestRow = await get<[number] | { sent_at: number }>(
    db,
    "SELECT sent_at FROM sent_emails WHERE user_id = ? AND type = 'digest' ORDER BY sent_at DESC LIMIT 1",
    [uid]
  );
  const lastSentAt = lastDigestRow
    ? (Array.isArray(lastDigestRow) ? lastDigestRow[0] : lastDigestRow.sent_at)
    : 0;

  return {
    userId: uid,
    email,
    sources: sourcesRows.map((r) => {
      const [source_url, label] = rowToSource(r);
      return { source_url, label };
    }),
    mode,
    categories,
    fetchWindowHours,
    lastSentAt,
  };
}

function getDigestSubject(): string {
  const d = new Date();
  const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return `${dateStr}摘要`;
}

export async function processUser(user: UserToNotify): Promise<{ sent: boolean }> {
  const db = await getDb();
  let items = await getCachedNews(db, user.userId, user.fetchWindowHours);

  const lastFetchedAt = await getMostRecentFetchedAt(db, user.userId);
  const freshnessThresholdSec = (user.fetchWindowHours / 2) * 3600;
  const cacheStale = lastFetchedAt > 0 && Math.floor(Date.now() / 1000) - lastFetchedAt > freshnessThresholdSec;

  if (items.length === 0 || cacheStale) {
    const fetched = await fetchAndMerge(user.sources, {
      fetchWindowHours: user.fetchWindowHours > 0 ? user.fetchWindowHours : undefined,
    });
    await upsertNewsCache(db, user.userId, fetched);
    items = fetched;
  }
  const filtered = filterNews(items, user.mode, user.categories);
  console.log(`Cached ${items.length} items, filtered to ${filtered.length}`);
  if (filtered.length === 0) {
    console.log(`[Digest] Skipped empty digest for ${user.email} (items=${items.length}, mode=${user.mode}, categories=${user.categories.length})`);
    return { sent: false };
  }
  const translated = await translateBatch(filtered);
  const htmlTable = buildDigestTable(translated);
  const subject = getDigestSubject();
  const html = await sendDigestEmail(user.email, htmlTable, subject);
  await logSentEmail(user.userId, "digest", subject, html);
  return { sent: true };
}

export async function runTick(): Promise<void> {
  const users = await getUsersToNotify();
  for (const user of users) {
    try {
      const { sent } = await processUser(user);
      if (sent) console.log(`Digest sent to ${user.email}`);
    } catch (err) {
      console.error(`Failed to send digest to ${user.email}:`, err);
    }
  }
}

/** Per-user fetch: fetch all sources for each user, write to news_cache. Uses fetchWindowHours to limit cache scope. */
export async function runFetchTask(): Promise<void> {
  const users = await getUsersWithSources();
  const db = await getDb();
  for (const { userId, sources, fetchWindowHours } of users) {
    try {
      const items = await fetchAndMerge(sources, {
        fetchWindowHours: fetchWindowHours > 0 ? fetchWindowHours : undefined,
      });
      await upsertNewsCache(db, userId, items);
      console.log(`[Fetch] user ${userId}: ${items.length} items cached`);
    } catch (err) {
      console.error(`[Fetch] user ${userId} failed:`, err);
    }
  }
}

/** Delete news_cache entries older than 7 days. */
export async function runCleanupTask(): Promise<void> {
  const cutoffSec = Math.floor((Date.now() - 7 * 24 * 3600 * 1000) / 1000);
  const db = await getDb();
  await cleanupExpiredCache(db, cutoffSec);
  console.log("[Cleanup] expired news_cache entries removed");
}

async function main(): Promise<void> {
  await getDb();
  cron.schedule("* * * * *", () => {
    runTick().catch(console.error);
  });
  cron.schedule("0 */8 * * *", () => {
    runFetchTask().catch(console.error);
  });
  cron.schedule("0 3 * * *", () => {
    runCleanupTask().catch(console.error);
  });
  console.log("Cron started. Minute tick, 8h fetch, daily cleanup.");
}

main().catch(console.error);

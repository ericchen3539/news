/**
 * Cron job - runs every minute, checks which users should receive digest, fetches, filters, translates, sends.
 */

import cron from "node-cron";
import { getDb, saveDb } from "../db/index.js";
import { all, get } from "../db/query.js";
import { fetchAndMerge } from "../fetcher/index.js";
import { filterNews } from "../filter/engine.js";
import { translateBatch } from "../translate/index.js";
import { buildDigestTable } from "../email/template.js";
import { sendDigestEmail } from "../email/send.js";

interface UserToNotify {
  userId: number;
  email: string;
  sources: { source_url: string; label: string }[];
  mode: "include" | "exclude";
  categories: string[];
}

function rowToUser(r: [number, string] | { id: number; email: string }): [number, string] {
  return Array.isArray(r) ? r : [r.id, r.email];
}

function rowToSource(r: [string, string] | { source_url: string; label: string }): [string, string] {
  return Array.isArray(r) ? r : [r.source_url, r.label];
}

async function getUsersToNotify(): Promise<UserToNotify[]> {
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
      [string, string, string, number, number] | {
        frequency: string;
        send_time: string;
        timezone: string;
        weekday: number;
        day_of_month: number;
      }
    >(
      db,
      "SELECT frequency, send_time, timezone, weekday, day_of_month FROM user_schedules WHERE user_id = ?",
      [userId]
    );
    const frequency = (Array.isArray(scheduleRow) ? scheduleRow?.[0] : scheduleRow?.frequency) ?? "daily";
    const sendTime = (Array.isArray(scheduleRow) ? scheduleRow?.[1] : scheduleRow?.send_time) ?? "06:00";
    const timezone = (Array.isArray(scheduleRow) ? scheduleRow?.[2] : scheduleRow?.timezone) ?? "Asia/Shanghai";
    const weekday = (Array.isArray(scheduleRow) ? scheduleRow?.[3] : scheduleRow?.weekday) ?? 1;
    const dayOfMonth = (Array.isArray(scheduleRow) ? scheduleRow?.[4] : scheduleRow?.day_of_month) ?? 1;

    const [h, m] = sendTime.split(":").map(Number);
    const userDate = new Date(
      new Date().toLocaleString("en-US", { timeZone: timezone })
    );
    const userHour = userDate.getHours();
    const userMin = userDate.getMinutes();
    const userDay = userDate.getDay();
    const userDateNum = userDate.getDate();

    let shouldSend = false;
    if (frequency === "daily") {
      shouldSend = userHour === h && userMin === m;
    } else if (frequency === "weekly") {
      shouldSend = userDay === weekday && userHour === h && userMin === m;
    } else if (frequency === "biweekly") {
      const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
      shouldSend =
        userDay === weekday && userHour === h && userMin === m && weekNum % 2 === 0;
    } else if (frequency === "monthly") {
      shouldSend =
        userDateNum === dayOfMonth && userHour === h && userMin === m;
    }

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
      });
    }
  }

  return result;
}

async function processUser(user: UserToNotify): Promise<void> {
  const items = await fetchAndMerge(user.sources);
  const filtered = filterNews(items, user.mode, user.categories);
  const translated = await translateBatch(filtered);
  const html = buildDigestTable(translated);
  await sendDigestEmail(user.email, html);
}

async function runTick(): Promise<void> {
  const users = await getUsersToNotify();
  for (const user of users) {
    try {
      await processUser(user);
      console.log(`Digest sent to ${user.email}`);
    } catch (err) {
      console.error(`Failed to send digest to ${user.email}:`, err);
    }
  }
}

async function main(): Promise<void> {
  await getDb();
  cron.schedule("* * * * *", () => {
    runTick().catch(console.error);
  });
  console.log("Cron started. Running every minute.");
}

main().catch(console.error);

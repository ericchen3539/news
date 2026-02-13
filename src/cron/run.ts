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

async function getUsersToNotify(): Promise<UserToNotify[]> {
  const db = await getDb();

  const users = all<[number, string]>(
    db,
    "SELECT id, email FROM users WHERE verified_at IS NOT NULL"
  );
  const result: UserToNotify[] = [];

  for (const [userId, email] of users) {
    const sources = all<[string, string]>(
      db,
      "SELECT source_url, label FROM user_sources WHERE user_id = ?",
      [userId]
    );
    if (sources.length === 0) continue;

    const filterRow = get<[string, string]>(
      db,
      "SELECT mode, categories_json FROM user_filters WHERE user_id = ?",
      [userId]
    );
    const mode = (filterRow?.[0] as "include" | "exclude") ?? "include";
    let categories: string[] = [];
    try {
      categories = JSON.parse(filterRow?.[1] ?? "[]") ?? [];
    } catch {
      // ignore
    }

    const scheduleRow = get<[string, string, string, number, number]>(
      db,
      "SELECT frequency, send_time, timezone, weekday, day_of_month FROM user_schedules WHERE user_id = ?",
      [userId]
    );
    const frequency = scheduleRow?.[0] ?? "daily";
    const sendTime = scheduleRow?.[1] ?? "07:00";
    const timezone = scheduleRow?.[2] ?? "Asia/Shanghai";
    const weekday = scheduleRow?.[3] ?? 1;
    const dayOfMonth = scheduleRow?.[4] ?? 1;

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
        sources: sources.map(([source_url, label]) => ({ source_url, label })),
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

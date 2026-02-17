/**
 * User schedule CRUD (frequency_hours, send_time, timezone).
 * frequency_hours = send interval and fetch window (e.g. 4 = every 4h, past 4h news).
 */

import { Router } from "express";
import { getDb, saveDb } from "../db/index.js";
import { run, get } from "../db/query.js";
import { requireAuth } from "./middleware.js";
import { getUserForDigest, processUser } from "../cron/run.js";

const DEFAULT_SCHEDULE = {
  frequency_hours: 24,
  send_time: "06:00",
  timezone: "Asia/Shanghai",
};

export const scheduleRouter = Router();
scheduleRouter.use(requireAuth);

scheduleRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const db = await getDb();
  const row = await get<
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
  if (!row) {
    res.json({ ...DEFAULT_SCHEDULE, hasSchedule: false });
    return;
  }
  const frequency_hours = Array.isArray(row) ? (row[0] ?? 24) : (row.frequency_hours ?? 24);
  const send_time = Array.isArray(row) ? row[1] : row.send_time;
  const timezone = Array.isArray(row) ? row[2] : row.timezone;
  res.json({ frequency_hours, send_time, timezone, hasSchedule: true });
});

scheduleRouter.put("/", async (req, res) => {
  const userId = req.userId!;
  const { frequency_hours, send_time, timezone } = req.body ?? {};
  const fh =
    typeof frequency_hours === "number" && frequency_hours >= 1 && frequency_hours <= 2160
      ? Math.floor(frequency_hours)
      : DEFAULT_SCHEDULE.frequency_hours;
  const sendTime = send_time ?? DEFAULT_SCHEDULE.send_time;
  const tz = timezone ?? DEFAULT_SCHEDULE.timezone;

  const db = await getDb();
  const isPg = typeof (db as { query?: unknown }).query === "function";
  if (isPg) {
    await (db as { query: (s: string, p?: unknown[]) => Promise<unknown> }).query(
      `INSERT INTO user_schedules (user_id, frequency_hours, send_time, timezone, frequency, weekday, day_of_month, fetch_window_hours)
       VALUES ($1, $2, $3, $4, 'daily', 1, 1, $5)
       ON CONFLICT(user_id) DO UPDATE SET frequency_hours = EXCLUDED.frequency_hours,
         send_time = EXCLUDED.send_time, timezone = EXCLUDED.timezone,
         frequency = EXCLUDED.frequency, weekday = EXCLUDED.weekday, day_of_month = EXCLUDED.day_of_month,
         fetch_window_hours = EXCLUDED.fetch_window_hours`,
      [userId, fh, sendTime, tz, fh]
    );
  } else {
    await run(
      db,
      `INSERT INTO user_schedules (user_id, frequency_hours, send_time, timezone, frequency, weekday, day_of_month, fetch_window_hours)
       VALUES (?, ?, ?, ?, 'daily', 1, 1, ?)
       ON CONFLICT(user_id) DO UPDATE SET frequency_hours = excluded.frequency_hours,
         send_time = excluded.send_time, timezone = excluded.timezone,
         frequency = excluded.frequency, weekday = excluded.weekday, day_of_month = excluded.day_of_month,
         fetch_window_hours = excluded.fetch_window_hours`,
      [userId, fh, sendTime, tz, fh]
    );
    saveDb();
  }
  res.json({ frequency_hours: fh, send_time: sendTime, timezone: tz });
});

scheduleRouter.post("/send-now", async (req, res) => {
  const userId = req.userId!;
  const user = await getUserForDigest(userId);
  if (!user) {
    res.status(400).json({
      error: "请先添加新闻源并验证邮箱后再试",
    });
    return;
  }
  try {
    const { sent } = await processUser(user, "manual");
    if (sent) {
      res.json({ message: "摘要已发送，请查收邮箱" });
    } else {
      res.json({ message: "本时段暂无符合筛选条件的新闻，未发送邮件" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "发送失败";
    console.error("[Schedule] send-now failed:", err);
    res.status(500).json({ error: msg });
  }
});

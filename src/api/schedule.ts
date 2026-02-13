/**
 * User schedule CRUD (frequency, send_time, timezone, weekday, day_of_month).
 */

import { Router } from "express";
import { getDb, saveDb } from "../db/index.js";
import { run, get } from "../db/query.js";
import { requireAuth } from "./middleware.js";

const DEFAULT_SCHEDULE = {
  frequency: "daily",
  send_time: "06:00",
  timezone: "Asia/Shanghai",
  weekday: 1,
  day_of_month: 1,
};

export const scheduleRouter = Router();
scheduleRouter.use(requireAuth);

scheduleRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const db = await getDb();
  const row = await get<
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
  if (!row) {
    res.json({ ...DEFAULT_SCHEDULE, hasSchedule: false });
    return;
  }
  const frequency = Array.isArray(row) ? row[0] : row.frequency;
  const send_time = Array.isArray(row) ? row[1] : row.send_time;
  const timezone = Array.isArray(row) ? row[2] : row.timezone;
  const weekday = Array.isArray(row) ? row[3] : row.weekday;
  const day_of_month = Array.isArray(row) ? row[4] : row.day_of_month;
  res.json({ frequency, send_time, timezone, weekday, day_of_month, hasSchedule: true });
});

scheduleRouter.put("/", async (req, res) => {
  const userId = req.userId!;
  const { frequency, send_time, timezone, weekday, day_of_month } = req.body ?? {};
  const freq = frequency ?? DEFAULT_SCHEDULE.frequency;
  const validFreq = ["daily", "weekly", "biweekly", "monthly"].includes(freq);
  if (!validFreq) {
    res.status(400).json({ error: "frequency must be daily, weekly, biweekly, or monthly" });
    return;
  }
  const sendTime = send_time ?? DEFAULT_SCHEDULE.send_time;
  const tz = timezone ?? DEFAULT_SCHEDULE.timezone;
  const wd = typeof weekday === "number" ? weekday : DEFAULT_SCHEDULE.weekday;
  const dom = typeof day_of_month === "number" ? day_of_month : DEFAULT_SCHEDULE.day_of_month;

  const db = await getDb();
  await run(
    db,
    `INSERT INTO user_schedules (user_id, frequency, send_time, timezone, weekday, day_of_month) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET frequency = excluded.frequency, send_time = excluded.send_time,
       timezone = excluded.timezone, weekday = excluded.weekday, day_of_month = excluded.day_of_month`,
    [userId, freq, sendTime, tz, wd, dom]
  );
  saveDb();
  res.json({ frequency: freq, send_time: sendTime, timezone: tz, weekday: wd, day_of_month: dom });
});

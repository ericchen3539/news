/**
 * Vercel Cron handler - invoked by Vercel Cron Jobs at scheduled intervals.
 * Validates CRON_SECRET before running digest tick.
 */

import { Router } from "express";
import { runTick } from "../cron/run.js";

export const cronRouter = Router();

cronRouter.get("/digest", async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    await runTick();
    res.json({ success: true, message: "Digest tick completed" });
  } catch (err) {
    console.error("[Cron] runTick failed:", err);
    res.status(500).json({ success: false, error: "Digest tick failed" });
  }
});

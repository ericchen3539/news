/**
 * Vercel Cron handler - invoked by Vercel Cron Jobs at scheduled intervals.
 * Validates CRON_SECRET before running digest tick.
 * Retries once on Neon transient connection errors (fetch failed / other side closed).
 */

import { Router } from "express";
import { runTick, runFetchTask } from "../cron/run.js";

export const cronRouter = Router();

function isNeonConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const causeMsg = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
  return (
    msg.includes("fetch failed") ||
    msg.includes("other side closed") ||
    msg.includes("Error connecting to database") ||
    causeMsg.includes("other side closed")
  );
}

cronRouter.get("/digest", async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await runTick();
      res.json({ success: true, message: "Digest tick completed" });
      return;
    } catch (err) {
      const shouldRetry = attempt < maxAttempts && isNeonConnectionError(err);
      if (shouldRetry) {
        console.warn(`[Cron] Attempt ${attempt} failed (Neon connection), retrying:`, err instanceof Error ? err.message : err);
        await new Promise((r) => setTimeout(r, 800));
      } else {
        console.error("[Cron] runTick failed:", err);
        res.status(500).json({ success: false, error: "Digest tick failed" });
        return;
      }
    }
  }
});

cronRouter.get("/fetch", async (req, res) => {
  const authHeader = req.headers.authorization;
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await runFetchTask();
      res.json({ success: true, message: "Fetch task completed" });
      return;
    } catch (err) {
      const shouldRetry = attempt < maxAttempts && isNeonConnectionError(err);
      if (shouldRetry) {
        console.warn(`[Cron] Fetch attempt ${attempt} failed (Neon connection), retrying:`, err instanceof Error ? err.message : err);
        await new Promise((r) => setTimeout(r, 800));
      } else {
        console.error("[Cron] runFetchTask failed:", err);
        res.status(500).json({ success: false, error: "Fetch task failed" });
        return;
      }
    }
  }
});

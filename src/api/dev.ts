/**
 * Dev-only endpoints for testing digest flow without waiting for cron.
 * Disabled in production (NODE_ENV=production and DEV_SEND_DIGEST not set).
 */

import { Router } from "express";
import { getUserForDigest, processUser } from "../cron/run.js";

const DEV_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.DEV_SEND_DIGEST === "1";

export const devRouter = Router();

devRouter.post("/send-digest-now", async (req, res) => {
  if (!DEV_ENABLED) {
    res.status(403).json({ error: "Dev endpoint disabled in production" });
    return;
  }

  const userId = Number(req.body?.userId ?? req.query.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    res.status(400).json({ error: "Valid userId required (body.userId or query.userId)" });
    return;
  }

  const user = await getUserForDigest(userId);
  if (!user) {
    res.status(404).json({
      error: "User not found or not eligible (must be verified with sources configured)",
    });
    return;
  }

  try {
    const { sent } = await processUser(user, "manual");
    if (sent) {
      res.json({ message: `Digest sent to ${user.email}` });
    } else {
      res.json({ message: "本时段暂无符合筛选条件的新闻，未发送邮件" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    console.error("[Dev] send-digest-now failed:", err);
    res.status(500).json({ error: msg });
  }
});

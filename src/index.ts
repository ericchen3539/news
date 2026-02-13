/**
 * News Digest Email System - Main entry point.
 * Serves API for registration, source/filter/schedule config, and runs cron for digest delivery.
 */

import express from "express";
import cors from "cors";
import { join } from "path";
import { apiRouter } from "./api/router.js";

const publicDir = join(process.cwd(), "public");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", apiRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(express.static(publicDir));
app.get("/verify", (_req, res) => {
  res.sendFile(join(publicDir, "verify.html"));
});

if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;

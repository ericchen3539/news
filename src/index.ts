/**
 * News Digest Email System - Main entry point.
 * Serves API for registration, source/filter/schedule config, and runs cron for digest delivery.
 */

import express from "express";
import cors from "cors";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { apiRouter } from "./api/router.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", apiRouter);

app.use(express.static(join(__dirname, "../public")));

app.get("/verify", (req, res) => {
  res.sendFile(join(__dirname, "../public/verify.html"));
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

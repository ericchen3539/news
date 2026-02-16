/**
 * User filter rules CRUD.
 */

import { Router } from "express";
import { getDb, saveDb } from "../db/index.js";
import { run, get } from "../db/query.js";
import { requireAuth } from "./middleware.js";

export const filtersRouter = Router();
filtersRouter.use(requireAuth);

filtersRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const db = await getDb();
  const row = await get<[string, string] | { mode: string; categories_json: string }>(
    db,
    "SELECT mode, categories_json FROM user_filters WHERE user_id = ?",
    [userId]
  );
  if (!row) {
    res.json({ mode: "include", categories: [] });
    return;
  }
  const mode = Array.isArray(row) ? row[0] : row.mode;
  const categories_json = Array.isArray(row) ? row[1] : row.categories_json;
  const categories = JSON.parse(categories_json ?? "[]") as string[];
  res.json({ mode: mode as "include" | "exclude", categories });
});

filtersRouter.put("/", async (req, res) => {
  const userId = req.userId!;
  const { mode, categories } = req.body ?? {};
  if (!mode || !["include", "exclude"].includes(mode)) {
    res.status(400).json({ error: "mode must be 'include' or 'exclude'" });
    return;
  }
  const categoriesArr = Array.isArray(categories) ? categories : [];
  if (mode === "include" && categoriesArr.length === 0) {
    res.status(400).json({ error: "包含模式必须至少选择一个类别" });
    return;
  }
  const db = await getDb();
  await run(
    db,
    `INSERT INTO user_filters (user_id, mode, categories_json) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET mode = excluded.mode, categories_json = excluded.categories_json`,
    [userId, mode, JSON.stringify(categoriesArr)]
  );
  saveDb();
  res.json({ mode, categories: categoriesArr });
});

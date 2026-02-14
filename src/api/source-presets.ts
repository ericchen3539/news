/**
 * Source presets - e.g. Google News categories for quick-add.
 */

import { Router } from "express";
import { getGoogleNewsPresetsList } from "../fetcher/source-presets.js";

export const sourcePresetsRouter = Router();

sourcePresetsRouter.get("/", (_req, res) => {
  res.json({
    googleNews: getGoogleNewsPresetsList(),
  });
});

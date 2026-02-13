/**
 * Filter presets - returns list of preset categories for user selection.
 */

import { Router } from "express";
import { getFilterPresetsList } from "../filter/presets.js";

export const filterPresetsRouter = Router();

filterPresetsRouter.get("/", (_req, res) => {
  res.json(getFilterPresetsList());
});

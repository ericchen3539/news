/**
 * API router - registers all routes.
 */

import { Router } from "express";
import { authRouter } from "./auth.js";
import { filterPresetsRouter } from "./filter-presets.js";
import { sourcesRouter } from "./sources.js";
import { filtersRouter } from "./filters.js";
import { scheduleRouter } from "./schedule.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/filter-presets", filterPresetsRouter);
apiRouter.use("/sources", sourcesRouter);
apiRouter.use("/filters", filtersRouter);
apiRouter.use("/schedule", scheduleRouter);

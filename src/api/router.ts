/**
 * API router - registers all routes.
 */

import { Router } from "express";
import { authRouter } from "./auth.js";
import { cronRouter } from "./cron.js";
import { devRouter } from "./dev.js";
import { filterPresetsRouter } from "./filter-presets.js";
import { sourcePresetsRouter } from "./source-presets.js";
import { sourcesRouter } from "./sources.js";
import { filtersRouter } from "./filters.js";
import { scheduleRouter } from "./schedule.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/cron", cronRouter);
apiRouter.use("/dev", devRouter);
apiRouter.use("/filter-presets", filterPresetsRouter);
apiRouter.use("/source-presets", sourcePresetsRouter);
apiRouter.use("/sources", sourcesRouter);
apiRouter.use("/filters", filtersRouter);
apiRouter.use("/schedule", scheduleRouter);

/**
 * Auth middleware - extracts and verifies JWT.
 */

import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth/index.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.userId = payload.userId;
  next();
}

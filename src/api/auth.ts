/**
 * Auth routes: register, verify, login.
 */

import { Router } from "express";
import { register, verifyEmail, resendVerificationEmail, login } from "../auth/index.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  try {
    const result = await register(email, password);
    if (!result.ok) {
      res.status(result.statusCode ?? 400).json({ error: result.error });
      return;
    }
    res.json({ message: "Registration successful. Check your email to verify." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Registration failed";
    console.error("[Auth] Register error:", err);
    res.status(500).json({ error: msg });
  }
});

authRouter.get("/verify", async (req, res) => {
  const rawToken = req.query.token as string;
  if (!rawToken) {
    res.status(400).json({ error: "Token required" });
    return;
  }
  const token = rawToken.trim().toLowerCase();
  const result = await verifyEmail(token);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ message: "Email verified successfully." });
});

authRouter.post("/resend-verification", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email required" });
    return;
  }
  try {
    const result = await resendVerificationEmail(email);
    if (!result.ok) {
      res.status(result.statusCode ?? 400).json({ error: result.error });
      return;
    }
    res.json({ message: "Verification email sent. Check your inbox." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Resend failed";
    console.error("[Auth] Resend verification error:", err);
    res.status(500).json({ error: msg });
  }
});

authRouter.post("/verify-email", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: "Email required" });
    return;
  }
  const { getDb, saveDb } = await import("../db/index.js");
  const { run, get } = await import("../db/query.js");
  const db = await getDb();
  const row = await get<[number] | { id: number }>(db, "SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const userId = Array.isArray(row) ? row[0] : row.id;
  const now = Math.floor(Date.now() / 1000);
  await run(db, "UPDATE users SET verified_at = ? WHERE id = ?", [now, userId]);
  saveDb();
  res.json({ message: "Email verified (dev)" });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  const result = await login(email, password);
  if (!result.ok) {
    res.status(401).json({ error: result.error });
    return;
  }
  res.json({ token: result.token });
});

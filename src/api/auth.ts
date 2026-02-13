/**
 * Auth routes: register, verify, login.
 */

import { Router } from "express";
import { register, verifyEmail, login } from "../auth/index.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  const result = await register(email, password);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ message: "Registration successful. Check your email to verify." });
});

authRouter.get("/verify", async (req, res) => {
  const token = req.query.token as string;
  if (!token) {
    res.status(400).json({ error: "Token required" });
    return;
  }
  const result = await verifyEmail(token);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ message: "Email verified successfully." });
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
  const row = get<[number]>(db, "SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  run(db, "UPDATE users SET verified_at = unixepoch() WHERE id = ?", [row[0]]);
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

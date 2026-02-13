/**
 * Auth: registration, email verification, JWT login.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { getDb, saveDb } from "../db/index.js";
import { run, get, runReturning } from "../db/query.js";
import { sendVerificationEmail } from "../email/send.js";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";
const TOKEN_EXPIRY_HOURS = 24;

export async function register(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string; statusCode?: number }> {
  const db = await getDb();

  const existing = await get<[number] | { id: number }>(db, "SELECT id FROM users WHERE email = ?", [
    email.toLowerCase(),
  ]);
  if (existing) {
    return { ok: false, error: "Email already registered" };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const insertRow = await runReturning<[number] | { id: number }>(
    db,
    "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id",
    [email.toLowerCase(), passwordHash]
  );
  const userId = Array.isArray(insertRow) ? insertRow[0] : insertRow?.id ?? 0;
  saveDb();

  const token = randomBytes(32).toString("hex");
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_HOURS * 3600;
  await run(db, "INSERT INTO verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)", [
    userId,
    token,
    expiresAt,
  ]);
  saveDb();

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/verify?token=${token}`;

  // Must await on Vercel: serverless functions terminate after response, fire-and-forget never completes
  try {
    await sendVerificationEmail(email, verifyUrl);
  } catch (err) {
    console.error("[Auth] Failed to send verification email:", err);
    return { ok: false, error: "Could not send verification email. Please try again later.", statusCode: 503 };
  }

  if (process.env.DEV_VERIFY_EMAIL === "1") {
    const now = Math.floor(Date.now() / 1000);
    await run(db, "UPDATE users SET verified_at = ? WHERE id = ?", [now, userId]);
    await run(db, "DELETE FROM verification_tokens WHERE token = ?", [token]);
    saveDb();
  }

  return { ok: true };
}

export async function verifyEmail(token: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();

  const row = await get<[number, number] | { user_id: number; expires_at: number }>(
    db,
    "SELECT user_id, expires_at FROM verification_tokens WHERE token = ?",
    [token]
  );
  if (!row) {
    return { ok: false, error: "Invalid or expired token" };
  }

  const userId = Array.isArray(row) ? row[0] : row.user_id;
  const expiresAt = Array.isArray(row) ? row[1] : row.expires_at;
  if (expiresAt < Math.floor(Date.now() / 1000)) {
    await run(db, "DELETE FROM verification_tokens WHERE token = ?", [token]);
    saveDb();
    return { ok: false, error: "Token expired" };
  }

  const now = Math.floor(Date.now() / 1000);
  await run(db, "UPDATE users SET verified_at = ? WHERE id = ?", [now, userId]);
  await run(db, "DELETE FROM verification_tokens WHERE token = ?", [token]);
  saveDb();

  return { ok: true };
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const db = await getDb();

  const row = await get<[number, string, number | null] | { id: number; password_hash: string; verified_at: number | null }>(
    db,
    "SELECT id, password_hash, verified_at FROM users WHERE email = ?",
    [email.toLowerCase()]
  );
  if (!row) {
    return { ok: false, error: "Invalid email or password" };
  }

  const id = Array.isArray(row) ? row[0] : row.id;
  const passwordHash = Array.isArray(row) ? row[1] : row.password_hash;
  const verifiedAt = Array.isArray(row) ? row[2] : row.verified_at;
  const match = await bcrypt.compare(password, passwordHash);
  if (!match) return { ok: false, error: "Invalid email or password" };

  if (!verifiedAt) {
    return { ok: false, error: "Email not verified. Check your inbox." };
  }

  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: "7d" });
  return { ok: true, token };
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

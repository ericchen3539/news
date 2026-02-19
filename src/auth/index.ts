/**
 * Auth: registration, email verification, JWT login.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { getDb, saveDb } from "../db/index.js";
import { run, get, runReturning } from "../db/query.js";
import { sendVerificationEmail } from "../email/send.js";
import { logSentEmail } from "../email/log.js";

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
  let html: string;
  try {
    html = await sendVerificationEmail(email, verifyUrl);
  } catch (err) {
    console.error("[Auth] Failed to send verification email:", err);
    return { ok: false, error: "Could not send verification email. Please try again later.", statusCode: 503 };
  }
  await logSentEmail(userId, "verification", "请验证您的邮箱 - 新闻摘要", html);

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
  const normalizedToken = token.trim().toLowerCase();

  const row = await get<[number, number] | { user_id: number; expires_at: number }>(
    db,
    "SELECT user_id, expires_at FROM verification_tokens WHERE LOWER(TRIM(token)) = ?",
    [normalizedToken]
  );
  if (!row) {
    return { ok: false, error: "Invalid or expired token" };
  }

  const userId = Array.isArray(row) ? row[0] : row.user_id;
  const expiresAt = Array.isArray(row) ? row[1] : row.expires_at;
  if (expiresAt < Math.floor(Date.now() / 1000)) {
    await run(db, "DELETE FROM verification_tokens WHERE user_id = ? AND expires_at = ?", [userId, expiresAt]);
    saveDb();
    return { ok: false, error: "Invalid or expired token" };
  }

  const now = Math.floor(Date.now() / 1000);
  await run(db, "UPDATE users SET verified_at = ? WHERE id = ?", [now, userId]);
  await run(db, "DELETE FROM verification_tokens WHERE user_id = ? AND expires_at = ?", [userId, expiresAt]);
  saveDb();

  return { ok: true };
}

/**
 * Resend verification email. Deletes old tokens for the user and sends a new one.
 */
export async function resendVerificationEmail(
  email: string
): Promise<{ ok: boolean; error?: string; statusCode?: number }> {
  const db = await getDb();

  const userRow = await get<[number] | { id: number }>(db, "SELECT id FROM users WHERE email = ?", [
    email.toLowerCase(),
  ]);
  if (!userRow) {
    return { ok: false, error: "Email not found" };
  }
  const userId = Array.isArray(userRow) ? userRow[0] : userRow.id;

  const verifiedRow = await get<[number] | { verified_at: number }>(
    db,
    "SELECT verified_at FROM users WHERE id = ?",
    [userId]
  );
  const verifiedAt = verifiedRow ? (Array.isArray(verifiedRow) ? verifiedRow[0] : verifiedRow.verified_at) : null;
  if (verifiedAt) {
    return { ok: false, error: "Email already verified" };
  }

  await run(db, "DELETE FROM verification_tokens WHERE user_id = ?", [userId]);
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

  let html: string;
  try {
    html = await sendVerificationEmail(email, verifyUrl);
  } catch (err) {
    console.error("[Auth] Failed to resend verification email:", err);
    return { ok: false, error: "Could not send verification email. Please try again later.", statusCode: 503 };
  }
  await logSentEmail(userId, "verification", "请验证您的邮箱 - 新闻摘要", html);

  return { ok: true };
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const db = await getDb();

  const row = await get<[number, string] | { id: number; password_hash: string }>(
    db,
    "SELECT id, password_hash FROM users WHERE email = ?",
    [email.toLowerCase()]
  );
  if (!row) {
    return { ok: false, error: "Invalid email or password" };
  }

  const id = Array.isArray(row) ? row[0] : row.id;
  const passwordHash = Array.isArray(row) ? row[1] : row.password_hash;
  const match = await bcrypt.compare(password, passwordHash);
  if (!match) return { ok: false, error: "Invalid email or password" };

  // Allow unverified users to login so they can access re-verification flow from config page
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

/**
 * Get current user info (email, verified status) by userId.
 */
export async function getMe(userId: number): Promise<{ email: string; verified: boolean } | null> {
  const db = await getDb();
  const row = await get<[string, number | null] | { email: string; verified_at: number | null }>(
    db,
    "SELECT email, verified_at FROM users WHERE id = ?",
    [userId]
  );
  if (!row) return null;
  const email = Array.isArray(row) ? row[0] : row.email;
  const verifiedAt = Array.isArray(row) ? row[1] : row.verified_at;
  return { email, verified: !!verifiedAt };
}

/**
 * Resend verification email by userId (for authenticated users).
 */
export async function resendVerificationEmailByUserId(
  userId: number
): Promise<{ ok: boolean; error?: string; statusCode?: number }> {
  const db = await getDb();
  const row = await get<[string] | { email: string }>(db, "SELECT email FROM users WHERE id = ?", [userId]);
  if (!row) return { ok: false, error: "User not found" };
  const email = Array.isArray(row) ? row[0] : row.email;
  return resendVerificationEmail(email);
}

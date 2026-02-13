/**
 * Auth: registration, email verification, JWT login.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { getDb, saveDb } from "../db/index.js";
import { run, get, all } from "../db/query.js";
import { sendVerificationEmail } from "../email/send.js";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";
const TOKEN_EXPIRY_HOURS = 24;

export async function register(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();

  const existing = get<[number]>(db, "SELECT id FROM users WHERE email = ?", [
    email.toLowerCase(),
  ]);
  if (existing) {
    return { ok: false, error: "Email already registered" };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  run(db, "INSERT INTO users (email, password_hash) VALUES (?, ?)", [
    email.toLowerCase(),
    passwordHash,
  ]);
  saveDb();

  const row = get<[number]>(db, "SELECT last_insert_rowid() as id");
  const userId = row?.[0] ?? 0;

  const token = randomBytes(32).toString("hex");
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_HOURS * 3600;
  run(db, "INSERT INTO verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)", [
    userId,
    token,
    expiresAt,
  ]);
  saveDb();

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/verify?token=${token}`;
  await sendVerificationEmail(email, verifyUrl);

  if (process.env.DEV_VERIFY_EMAIL === "1") {
    run(db, "UPDATE users SET verified_at = unixepoch() WHERE id = ?", [userId]);
    run(db, "DELETE FROM verification_tokens WHERE token = ?", [token]);
    saveDb();
  }

  return { ok: true };
}

export async function verifyEmail(token: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();

  const row = get<[number, number]>(
    db,
    "SELECT user_id, expires_at FROM verification_tokens WHERE token = ?",
    [token]
  );
  if (!row) {
    return { ok: false, error: "Invalid or expired token" };
  }

  const [userId, expiresAt] = row;
  if (expiresAt < Math.floor(Date.now() / 1000)) {
    run(db, "DELETE FROM verification_tokens WHERE token = ?", [token]);
    saveDb();
    return { ok: false, error: "Token expired" };
  }

  run(db, "UPDATE users SET verified_at = unixepoch() WHERE id = ?", [userId]);
  run(db, "DELETE FROM verification_tokens WHERE token = ?", [token]);
  saveDb();

  return { ok: true };
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const db = await getDb();

  const row = get<[number, string, number | null]>(
    db,
    "SELECT id, password_hash, verified_at FROM users WHERE email = ?",
    [email.toLowerCase()]
  );
  if (!row) {
    return { ok: false, error: "Invalid email or password" };
  }

  const [id, passwordHash, verifiedAt] = row;
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

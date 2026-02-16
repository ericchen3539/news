/**
 * Database schema definitions and migration.
 */

export const SCHEMA = `
-- Users: email registration and auth
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  verified_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- User news sources (RSS URLs)
CREATE TABLE IF NOT EXISTS user_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- User filter rules (preset categories, include/exclude mode)
CREATE TABLE IF NOT EXISTS user_filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('include', 'exclude')),
  categories_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- User schedule: frequency_hours = send interval (hours), fetch window = frequency_hours
CREATE TABLE IF NOT EXISTS user_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  frequency_hours INTEGER NOT NULL DEFAULT 24 CHECK (frequency_hours >= 1 AND frequency_hours <= 2160),
  send_time TEXT NOT NULL DEFAULT '06:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  frequency TEXT DEFAULT 'daily',
  weekday INTEGER DEFAULT 1,
  day_of_month INTEGER DEFAULT 1,
  fetch_window_hours INTEGER DEFAULT 24,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Sent email log (for user query)
CREATE TABLE IF NOT EXISTS sent_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('verification', 'digest')),
  subject TEXT NOT NULL,
  content TEXT,
  sent_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- News cache: per-user fetched items for digest (fetched every 8h)
CREATE TABLE IF NOT EXISTS news_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_label TEXT NOT NULL DEFAULT '',
  pub_date INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, link)
);

CREATE INDEX IF NOT EXISTS idx_user_sources_user ON user_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_sent_emails_user_id ON sent_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_news_cache_user_pub ON news_cache(user_id, pub_date);
`;

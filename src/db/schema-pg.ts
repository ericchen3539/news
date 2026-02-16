/**
 * PostgreSQL schema for Neon. Each statement must be executed separately
 * (Neon/Postgres prepared statements do not support multiple commands).
 */

export const SCHEMA_PG_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    verified_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
  )`,
  `CREATE TABLE IF NOT EXISTS user_sources (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
  )`,
  `CREATE TABLE IF NOT EXISTS user_filters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('include', 'exclude')),
    categories_json TEXT NOT NULL DEFAULT '[]',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
  )`,
  `CREATE TABLE IF NOT EXISTS user_schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    frequency_hours INTEGER NOT NULL DEFAULT 24 CHECK (frequency_hours >= 1 AND frequency_hours <= 2160),
    send_time TEXT NOT NULL DEFAULT '06:00',
    timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    frequency TEXT DEFAULT 'daily',
    weekday INTEGER DEFAULT 1,
    day_of_month INTEGER DEFAULT 1,
    fetch_window_hours INTEGER DEFAULT 24,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
  )`,
  `CREATE TABLE IF NOT EXISTS verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
  )`,
  `CREATE TABLE IF NOT EXISTS sent_emails (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('verification', 'digest')),
    subject TEXT NOT NULL,
    content TEXT,
    sent_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
  )`,
  `CREATE TABLE IF NOT EXISTS news_cache (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    link TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    source_label TEXT NOT NULL DEFAULT '',
    pub_date BIGINT NOT NULL,
    fetched_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT),
    UNIQUE(user_id, link)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_news_cache_user_pub ON news_cache(user_id, pub_date)`,
  `CREATE INDEX IF NOT EXISTS idx_user_sources_user ON user_sources(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token)`,
  `CREATE INDEX IF NOT EXISTS idx_sent_emails_user_id ON sent_emails(user_id)`,
  `ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS content TEXT`,
];

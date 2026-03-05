-- Run this once in your Neon SQL editor to set up the database

-- Admin users (only 2, manually inserted)
CREATE TABLE IF NOT EXISTS admins (
  id         SERIAL PRIMARY KEY,
  username   TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,  -- bcrypt hash
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- License keys
CREATE TABLE IF NOT EXISTS license_keys (
  id          SERIAL PRIMARY KEY,
  key_value   TEXT UNIQUE NOT NULL,  -- stored as plain, shown to admin
  key_hash    TEXT NOT NULL,         -- bcrypt hash, used for validation
  label       TEXT,
  status      TEXT NOT NULL DEFAULT 'active'  CHECK (status IN ('active','disabled','expired')),
  hwid        TEXT,                  -- bound after first use
  uses        INT NOT NULL DEFAULT 0,
  max_uses    INT,                   -- NULL = unlimited
  expires_at  TIMESTAMPTZ,          -- NULL = never
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_used   TIMESTAMPTZ
);

-- Key validation log
CREATE TABLE IF NOT EXISTS key_logs (
  id         SERIAL PRIMARY KEY,
  key_id     INT REFERENCES license_keys(id) ON DELETE SET NULL,
  key_value  TEXT,
  hwid       TEXT,
  ip         TEXT,
  success    BOOLEAN NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_keys_value  ON license_keys(key_value);
CREATE INDEX IF NOT EXISTS idx_logs_key_id ON key_logs(key_id);

-- ============================================================
-- INSERT YOUR 2 ADMIN USERS (replace hashes with real bcrypt)
-- Generate hashes at: https://bcrypt-generator.com (rounds=12)
-- Or run: node -e "const b=require('bcryptjs');console.log(b.hashSync('yourpassword',12))"
-- ============================================================

-- Example (DELETE these and insert real hashes):
-- INSERT INTO admins (username, password) VALUES
--   ('admin1', '$2a$12$REPLACE_WITH_REAL_HASH'),
--   ('admin2', '$2a$12$REPLACE_WITH_REAL_HASH')
-- ON CONFLICT DO NOTHING;

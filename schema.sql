-- Run this once in your Neon SQL editor to set up the database

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

-- Key validation log (written only when the program calls /api/validate, NOT on download)
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

-- Admin credentials are stored in environment variables (ADMIN1_USERNAME, ADMIN1_PASSWORD, etc.)
-- No DB table needed for admins.

-- App settings (key/value store for admin-configurable values)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default download URL (update this via the dashboard settings)
INSERT INTO app_settings (key, value)
VALUES ('download_url', 'https://github.com/YOUR_USERNAME/YOUR_REPO/releases/download/latest/passion.exe')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS tiktok_auth_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tiktok_auth_rate_limits_window
  ON tiktok_auth_rate_limits (window_started_at);

CREATE TABLE IF NOT EXISTS tiktok_oauth_states (
  state_hash TEXT PRIMARY KEY,
  redirect_uri TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX IF NOT EXISTS tiktok_oauth_states_expiration
  ON tiktok_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS tiktok_token_refresh_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  lock_token TEXT NOT NULL,
  locked_until INTEGER NOT NULL
);

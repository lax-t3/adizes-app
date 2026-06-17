-- Relay token store for /activate relay page.
-- Each row holds a Supabase one-time action link keyed by an opaque UUID.
-- The email contains only the UUID — scanners cannot derive the Supabase
-- verify URL from it and therefore cannot consume the OTP token.
-- POST /auth/relay-link exchanges the UUID for the URL (single use, 24h TTL).

CREATE TABLE IF NOT EXISTS relay_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_url TEXT       NOT NULL,
  label        TEXT       NOT NULL DEFAULT 'activate',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  used         BOOLEAN    NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_relay_tokens_expires_at ON relay_tokens (expires_at);

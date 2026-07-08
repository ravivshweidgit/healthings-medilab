CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('patient', 'mentor')),
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;

CREATE TABLE IF NOT EXISTS otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL,
  code_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('patient', 'mentor')),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_requests_email_created
  ON otp_requests (email, created_at DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS account_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users (id) ON DELETE CASCADE,
  patient_email CITEXT NOT NULL,
  mentor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('patient', 'mentor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (patient_id IS NULL OR patient_id != mentor_id)
);

CREATE INDEX IF NOT EXISTS idx_shares_mentor_status
  ON account_shares (mentor_id, status);

CREATE INDEX IF NOT EXISTS idx_shares_patient_status
  ON account_shares (patient_id, status)
  WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shares_patient_email_pending
  ON account_shares (patient_email, status)
  WHERE patient_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_one_active_per_pair
  ON account_shares (patient_id, mentor_id)
  WHERE status = 'approved' AND patient_id IS NOT NULL;

-- AI billing: mentor-initiated, one sponsor per patient (independent of data shares).
CREATE TABLE IF NOT EXISTS ai_sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  share_pct INT NOT NULL DEFAULT 100 CHECK (share_pct = 100),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_sponsorships_one_per_patient
  ON ai_sponsorships (patient_id);

CREATE INDEX IF NOT EXISTS idx_ai_sponsorships_sponsor
  ON ai_sponsorships (sponsor_id);

CREATE INDEX IF NOT EXISTS idx_ai_sponsorships_expires
  ON ai_sponsorships (expires_at);

-- Meter AI usage (always log; wallet debit optional via BILLING_ENFORCE).
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  payer_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sponsor_id UUID REFERENCES users (id) ON DELETE SET NULL,
  sponsored BOOLEAN NOT NULL DEFAULT FALSE,
  tokens INT NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_payer_created
  ON ai_usage_events (payer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_patient_created
  ON ai_usage_events (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_sponsor_created
  ON ai_usage_events (sponsor_id, created_at DESC)
  WHERE sponsor_id IS NOT NULL;

-- ─── Legacy migration (idempotent) ───────────────────────────────────────────

DROP INDEX IF EXISTS idx_shares_one_sponsor_per_patient;

ALTER TABLE account_shares DROP COLUMN IF EXISTS sponsor_ai;

-- Keep one sponsor row per patient when migrating from multi-sponsor experiments.
DELETE FROM ai_sponsorships a
USING ai_sponsorships b
WHERE a.patient_id = b.patient_id
  AND a.updated_at < b.updated_at;

ALTER TABLE ai_sponsorships DROP CONSTRAINT IF EXISTS ai_sponsorships_patient_id_sponsor_id_key;

ALTER TABLE ai_sponsorships ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
UPDATE ai_sponsorships SET expires_at = NOW() + INTERVAL '90 days' WHERE expires_at IS NULL;

CREATE TABLE IF NOT EXISTS wallets (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  balance_tokens INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  delta INT NOT NULL,
  reason TEXT NOT NULL,
  ref_type TEXT,
  ref_id UUID,
  payer_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user
  ON wallet_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_methods (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  card_last4 TEXT,
  card_brand TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Encrypted patient snapshots (alpha: gzip payload + access control; E2E wrap later).
CREATE TABLE IF NOT EXISTS sync_blobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  version INT NOT NULL,
  byte_size INT NOT NULL,
  payload_hash TEXT NOT NULL,
  summary JSONB NOT NULL,
  payload_gzip BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, version)
);

CREATE INDEX IF NOT EXISTS idx_sync_blobs_patient_created
  ON sync_blobs (patient_id, created_at DESC);

-- Clinic asks patient to upload a fresh snapshot (cleared when patient shares).
CREATE TABLE IF NOT EXISTS sync_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, mentor_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_update_requests_patient
  ON sync_update_requests (patient_id, requested_at DESC);

-- Mentor/clinic edits that overlay the patient snapshot (rules, clinic-side chat).
CREATE TABLE IF NOT EXISTS clinic_patient_overlays (
  patient_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  rules_json JSONB,
  chat_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL
);

-- Prior clinic overlay rules snapshots (archived before each rawText change).
CREATE TABLE IF NOT EXISTS clinic_patient_rules_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES users (id) ON DELETE SET NULL,
  rules_json JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_by TEXT NOT NULL DEFAULT 'clinic'
);

CREATE INDEX IF NOT EXISTS idx_rules_history_patient
  ON clinic_patient_rules_history (patient_id, saved_at DESC);

-- Optional patient cloud backup (one row per user; deleted when user turns off).
-- Previous blob retained for recovery if a bad overwrite slips through.
CREATE TABLE IF NOT EXISTS user_cloud_backups (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  byte_size INT NOT NULL,
  payload_hash TEXT NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL,
  payload_gzip BYTEA NOT NULL,
  fingerprint JSONB,
  prev_payload_gzip BYTEA,
  prev_byte_size INT,
  prev_exported_at TIMESTAMPTZ,
  prev_fingerprint JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_cloud_backups ADD COLUMN IF NOT EXISTS fingerprint JSONB;
ALTER TABLE user_cloud_backups ADD COLUMN IF NOT EXISTS prev_payload_gzip BYTEA;
ALTER TABLE user_cloud_backups ADD COLUMN IF NOT EXISTS prev_byte_size INT;
ALTER TABLE user_cloud_backups ADD COLUMN IF NOT EXISTS prev_exported_at TIMESTAMPTZ;
ALTER TABLE user_cloud_backups ADD COLUMN IF NOT EXISTS prev_fingerprint JSONB;

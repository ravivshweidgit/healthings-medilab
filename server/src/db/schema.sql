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

-- Patient legal-ish name for clinic worklist findability (be-27). Not display_name —
-- that column remains the mentor/clinic label shown to patients.
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Patient's own read-only web view at /account/. A second consumer of the same
-- snapshot a clinic reads, authorized by the same explicit, revocable gesture.
-- Off by default: nothing reaches the server without the patient turning it on.
ALTER TABLE users ADD COLUMN IF NOT EXISTS web_view_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Human-readable account number (1…n). UUID id stays the primary key.
CREATE SEQUENCE IF NOT EXISTS users_user_no_seq;
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_no INTEGER;
WITH max_existing AS (
  SELECT COALESCE(MAX(user_no), 0) AS m FROM users
),
ordered AS (
  SELECT id,
         (SELECT m FROM max_existing)
           + ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS n
  FROM users
  WHERE user_no IS NULL
)
UPDATE users u
SET user_no = o.n
FROM ordered o
WHERE u.id = o.id AND u.user_no IS NULL;
DO $$
DECLARE
  m INTEGER;
BEGIN
  SELECT MAX(user_no) INTO m FROM users;
  IF m IS NULL THEN
    PERFORM setval('users_user_no_seq', 1, false);
  ELSE
    PERFORM setval('users_user_no_seq', m, true);
  END IF;
END $$;
ALTER TABLE users ALTER COLUMN user_no SET DEFAULT nextval('users_user_no_seq');
ALTER TABLE users ALTER COLUMN user_no SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_no ON users (user_no);
ALTER SEQUENCE users_user_no_seq OWNED BY users.user_no;

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
-- tokens = Healthings prepaid credits charged. gemini_* = real Google usage
-- from usageMetadata (COGS/margin analytics only — never wallet math).
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  payer_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sponsor_id UUID REFERENCES users (id) ON DELETE SET NULL,
  sponsored BOOLEAN NOT NULL DEFAULT FALSE,
  tokens INT NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  gemini_prompt_tokens INT,
  gemini_candidates_tokens INT,
  gemini_thoughts_tokens INT,
  gemini_total_tokens INT,
  gemini_model TEXT,
  -- Phone prepaid bucket (be-33): client id for exactly-once flush; occurred_at = phone time.
  client_event_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

-- Real Gemini usage on pre-existing installs (2026-07: COGS analytics).
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS gemini_prompt_tokens INT;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS gemini_candidates_tokens INT;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS gemini_thoughts_tokens INT;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS gemini_total_tokens INT;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS gemini_model TEXT;

-- Phone batch flush idempotency (be-33).
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS client_event_id UUID;
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;
UPDATE ai_usage_events SET occurred_at = created_at WHERE occurred_at IS NULL;
ALTER TABLE ai_usage_events ALTER COLUMN occurred_at SET DEFAULT NOW();
ALTER TABLE ai_usage_events ALTER COLUMN occurred_at SET NOT NULL;

-- UNIQUE allows multiple NULLs in Postgres — legacy single-event rows stay NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_client_event
  ON ai_usage_events (client_event_id);

CREATE TABLE IF NOT EXISTS wallets (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  balance_tokens INT NOT NULL DEFAULT 0,
  -- be-34 dunning: card failure degrades payment routing, never clinical state.
  delinquent_since TIMESTAMPTZ,
  charge_attempts INT NOT NULL DEFAULT 0,
  coverage_paused BOOLEAN NOT NULL DEFAULT FALSE,
  next_retry_at TIMESTAMPTZ,
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

-- Invoices — production-shaped billing records from day one.
-- Alpha (BILLING_LIVE=false): every pack issues an invoice with charged_cents=0
-- and status 'comped_alpha'. Flipping BILLING_LIVE on switches the same flow to
-- real PSP charges (status 'paid'/'failed') without any schema change.
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  number TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  tokens INT NOT NULL,
  -- List price vs actually charged: they differ exactly while alpha comps.
  amount_cents INT NOT NULL,
  charged_cents INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('comped_alpha', 'paid', 'failed', 'pending')),
  provider TEXT NOT NULL CHECK (provider IN ('none', 'simulated', 'stripe', 'manual')),
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_created
  ON invoices (user_id, created_at DESC);

-- be-34 dunning columns on pre-existing wallets.
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS delinquent_since TIMESTAMPTZ;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS charge_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS coverage_paused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_wallets_delinquent_retry
  ON wallets (next_retry_at)
  WHERE delinquent_since IS NOT NULL;

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

-- ─── be-23: organizations, clinic-scoped overlays, access audit ───────────────
-- Consent is to the clinic (org). Rules are shared inside one org. AI chat is
-- private to the individual clinician. patient_access_log deliberately has no
-- FK on patient_id so the trail survives account deletion (be-19 exception).

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'clinician')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user
  ON org_members (user_id);

-- One org per existing mentor (one-person clinic). Idempotent: skips mentors
-- who already have a membership.
DO $$
DECLARE
  r RECORD;
  new_org UUID;
BEGIN
  FOR r IN
    SELECT u.id,
           COALESCE(NULLIF(TRIM(u.display_name), ''), u.email::text) AS org_name
    FROM users u
    WHERE u.role = 'mentor'
      AND NOT EXISTS (SELECT 1 FROM org_members m WHERE m.user_id = u.id)
  LOOP
    INSERT INTO organizations (name) VALUES (r.org_name) RETURNING id INTO new_org;
    INSERT INTO org_members (org_id, user_id, role) VALUES (new_org, r.id, 'owner');
  END LOOP;
END $$;

ALTER TABLE account_shares
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;

UPDATE account_shares s
SET org_id = m.org_id
FROM org_members m
WHERE m.user_id = s.mentor_id
  AND s.org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_shares_org_patient_status
  ON account_shares (org_id, patient_id, status)
  WHERE patient_id IS NOT NULL AND org_id IS NOT NULL;

-- Clinical direction: shared inside one clinic, invisible to any other clinic.
CREATE TABLE IF NOT EXISTS clinic_org_overlays (
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  rules_json JSONB,
  markers_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL,
  PRIMARY KEY (patient_id, org_id)
);

ALTER TABLE clinic_org_overlays
  ADD COLUMN IF NOT EXISTS markers_json JSONB;

-- AI chat: private to the individual clinician.
CREATE TABLE IF NOT EXISTS clinic_clinician_chats (
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  chat_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (patient_id, clinician_id)
);

-- Prior clinic overlay rules snapshots (archived before each rawText change).
CREATE TABLE IF NOT EXISTS clinic_patient_rules_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES users (id) ON DELETE SET NULL,
  org_id UUID REFERENCES organizations (id) ON DELETE SET NULL,
  rules_json JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_by TEXT NOT NULL DEFAULT 'clinic'
);

ALTER TABLE clinic_patient_rules_history
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rules_history_patient
  ON clinic_patient_rules_history (patient_id, saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_rules_history_org
  ON clinic_patient_rules_history (patient_id, org_id, saved_at DESC)
  WHERE org_id IS NOT NULL;

-- Append-only access audit. No FK on patient_id: deleting the subject must not
-- erase the fact that someone opened their record. be-19 findResidue must
-- exclude this table.
CREATE TABLE IF NOT EXISTS patient_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  actor_user_id UUID,
  org_id UUID,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_log_patient
  ON patient_access_log (patient_id, created_at DESC);

-- Migrate legacy clinic_patient_overlays → org overlays + clinician chats.
-- Ambiguity ladder (fail loudly, delete nothing if still unresolvable):
--   1. updated_by's org
--   2. sole approved share's org
--   3. most recent rules_history mentor's org
DO $$
DECLARE
  leftover INT;
BEGIN
  IF to_regclass('public.clinic_patient_overlays') IS NULL THEN
    RETURN;
  END IF;

  -- 1. updated_by's org
  INSERT INTO clinic_org_overlays (patient_id, org_id, rules_json, updated_at, updated_by)
  SELECT o.patient_id, m.org_id, o.rules_json, o.updated_at, o.updated_by
  FROM clinic_patient_overlays o
  JOIN org_members m ON m.user_id = o.updated_by
  ON CONFLICT (patient_id, org_id) DO NOTHING;

  INSERT INTO clinic_clinician_chats (patient_id, clinician_id, chat_json, updated_at)
  SELECT o.patient_id, o.updated_by, o.chat_json, o.updated_at
  FROM clinic_patient_overlays o
  WHERE o.updated_by IS NOT NULL
    AND o.chat_json IS NOT NULL
    AND o.chat_json <> '{}'::jsonb
  ON CONFLICT (patient_id, clinician_id) DO NOTHING;

  -- 2. sole approved share's org
  INSERT INTO clinic_org_overlays (patient_id, org_id, rules_json, updated_at, updated_by)
  SELECT o.patient_id, sole.org_id, o.rules_json, o.updated_at, o.updated_by
  FROM clinic_patient_overlays o
  JOIN LATERAL (
    SELECT (array_agg(sh.org_id ORDER BY sh.org_id::text))[1] AS org_id
    FROM account_shares sh
    WHERE sh.patient_id = o.patient_id
      AND sh.status = 'approved'
      AND sh.org_id IS NOT NULL
    HAVING COUNT(DISTINCT sh.org_id) = 1
  ) sole ON sole.org_id IS NOT NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM clinic_org_overlays x WHERE x.patient_id = o.patient_id
  )
  ON CONFLICT (patient_id, org_id) DO NOTHING;

  -- 3. most recent rules_history mentor's org
  INSERT INTO clinic_org_overlays (patient_id, org_id, rules_json, updated_at, updated_by)
  SELECT o.patient_id, m.org_id, o.rules_json, o.updated_at, o.updated_by
  FROM clinic_patient_overlays o
  JOIN LATERAL (
    SELECT h.mentor_id
    FROM clinic_patient_rules_history h
    WHERE h.patient_id = o.patient_id
      AND h.mentor_id IS NOT NULL
    ORDER BY h.saved_at DESC
    LIMIT 1
  ) hist ON TRUE
  JOIN org_members m ON m.user_id = hist.mentor_id
  WHERE NOT EXISTS (
    SELECT 1 FROM clinic_org_overlays x WHERE x.patient_id = o.patient_id
  )
  ON CONFLICT (patient_id, org_id) DO NOTHING;

  UPDATE clinic_patient_rules_history h
  SET org_id = m.org_id
  FROM org_members m
  WHERE h.mentor_id = m.user_id
    AND h.org_id IS NULL;

  SELECT COUNT(*)::int INTO leftover
  FROM clinic_patient_overlays o
  WHERE NOT EXISTS (
    SELECT 1 FROM clinic_org_overlays x WHERE x.patient_id = o.patient_id
  );

  IF leftover > 0 THEN
    RAISE EXCEPTION
      'be-23 migration: % clinic_patient_overlays row(s) unresolvable — left in place, deleted nothing',
      leftover;
  END IF;

  -- Unattributable chat (updated_by IS NULL): leave recorded in a notice, move nowhere.
  -- Alpha volumes; lost chat is recoverable in a way lost dietary rules are not.

  DROP TABLE clinic_patient_overlays;
END $$;

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

-- prompt113 / be-43: lab PDF country → providers → versioned prompt packs
CREATE TABLE IF NOT EXISTS lab_countries (
  code CHAR(2) PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_native TEXT,
  sort_order INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_providers (
  country_code CHAR(2) NOT NULL REFERENCES lab_countries (code) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_native TEXT,
  sort_order INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (country_code, code)
);

CREATE INDEX IF NOT EXISTS lab_providers_country_idx ON lab_providers (country_code) WHERE active;

-- kind: identify | parse_layout | parse_base | repair
-- provider_code '' = country-level pack (not a specific provider)
CREATE TABLE IF NOT EXISTS lab_prompt_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL REFERENCES lab_countries (code) ON DELETE CASCADE,
  provider_code TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('identify', 'parse_layout', 'parse_base', 'repair')),
  version INT NOT NULL DEFAULT 1,
  body TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, provider_code, kind, version)
);

CREATE INDEX IF NOT EXISTS lab_prompt_packs_active_idx
  ON lab_prompt_packs (country_code, kind, provider_code)
  WHERE active;

-- Seed IL / US + IL HMO packs (idempotent). Display: name_native ?? name_en (country brand, not appLocale).
INSERT INTO lab_countries (code, name_en, name_native, sort_order) VALUES
  ('IL', 'Israel', 'ישראל', 10),
  ('US', 'United States', NULL, 20)
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_native = COALESCE(EXCLUDED.name_native, lab_countries.name_native),
  sort_order = EXCLUDED.sort_order;

INSERT INTO lab_providers (country_code, code, name_en, name_native, sort_order) VALUES
  ('IL', 'clalit', 'Clalit', 'כללית', 10),
  ('IL', 'meuhedet', 'Meuhedet', 'מאוחדת', 20),
  ('IL', 'maccabi', 'Maccabi', 'מכבי', 30),
  ('IL', 'leumit', 'Leumit', 'לאומית', 40)
ON CONFLICT (country_code, code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_native = EXCLUDED.name_native,
  sort_order = EXCLUDED.sort_order,
  active = TRUE;

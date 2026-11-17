-- Independent Android identities. No automatic mapping to Toss accounts.
ALTER TABLE aimi.users ADD COLUMN android_identity_hash text UNIQUE;
ALTER TABLE aimi.users DROP CONSTRAINT users_identity_check;
ALTER TABLE aimi.users ADD CONSTRAINT users_identity_check
 CHECK (num_nonnulls(toss_user_key, dev_subject, toss_anon_key, android_identity_hash) = 1);
CREATE TABLE aimi.auth_rate_limits (
 bucket text PRIMARY KEY,
 window_start timestamptz NOT NULL,
 requests integer NOT NULL CHECK (requests > 0)
);
CREATE INDEX auth_rate_limits_window_idx ON aimi.auth_rate_limits(window_start);
REVOKE ALL ON aimi.auth_rate_limits FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='aimi_api') THEN
  GRANT SELECT, INSERT, UPDATE, DELETE ON aimi.auth_rate_limits TO aimi_api;
 END IF;
END $$;

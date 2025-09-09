-- RLS e políticas

-- Accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY accounts_rw ON accounts
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Custom Assets
ALTER TABLE custom_assets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY custom_assets_rw ON custom_assets
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY events_rw ON events
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Daily Positions: somente leitura pelo dono
ALTER TABLE daily_positions_acct ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY daily_positions_select ON daily_positions_acct
  FOR SELECT USING (user_id = app_current_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- User Profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY user_profiles_rw ON user_profiles
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Catálogo global: leitura pública
GRANT SELECT ON global_assets, global_price_daily TO anon, authenticated;

-- MV-like tables: revogar acesso direto
REVOKE ALL ON portfolio_value_daily FROM anon, authenticated;
REVOKE ALL ON portfolio_value_monthly FROM anon, authenticated;
REVOKE ALL ON portfolio_value_daily_acct FROM anon, authenticated;


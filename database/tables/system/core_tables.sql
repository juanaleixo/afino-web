
-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Catálogo público de ativos
CREATE TABLE IF NOT EXISTS global_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text UNIQUE NOT NULL,
  class text NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  manual_price numeric(20,10),
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- Preços diários históricos dos ativos globais
CREATE TABLE IF NOT EXISTS global_price_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_symbol text REFERENCES global_assets(symbol) ON DELETE CASCADE,
  date date NOT NULL,
  price numeric(20,10) NOT NULL,
  CONSTRAINT global_price_daily_asset_symbol_date_key UNIQUE (asset_symbol, date)
);

-- Ativos customizados por usuário
CREATE TABLE IF NOT EXISTS custom_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- user_profiles é definido em database/tables/user_profiles.sql

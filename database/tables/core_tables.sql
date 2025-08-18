-- Tabelas núcleo do domínio

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
  asset_id uuid REFERENCES global_assets(id) ON DELETE CASCADE,
  date date NOT NULL,
  price numeric(20,10) NOT NULL,
  UNIQUE(asset_id, date)
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

-- Eventos/Transações
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  account_id uuid REFERENCES accounts(id),
  asset_id uuid REFERENCES global_assets(id),
  tstamp timestamptz DEFAULT now(),
  kind text CHECK (kind IN (
    'deposit','withdraw','buy','sell','transfer','valuation',
    'qty_change','price_cache'
  )),
  units_delta numeric(38,18),
  price_override numeric(20,10),
  price_close numeric(20,10),
  meta jsonb
);

-- Posições diárias por conta+ativo (materializada via processo)
CREATE TABLE IF NOT EXISTS daily_positions_acct (
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  date date NOT NULL,
  units numeric(38,18) NOT NULL DEFAULT 0,
  price numeric(20,10),
  value numeric(20,10),
  currency text NOT NULL DEFAULT 'BRL',
  source_price text CHECK (source_price IN ('global','manual','custom')),
  is_final boolean DEFAULT true,
  PRIMARY KEY (user_id, account_id, asset_id, date)
);

-- Materialized-like tables de valores agregados
CREATE TABLE IF NOT EXISTS portfolio_value_daily (
  user_id uuid NOT NULL,
  date date NOT NULL,
  total_value numeric(20,10) DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS portfolio_value_monthly (
  user_id uuid NOT NULL,
  month_eom date NOT NULL,
  total_value numeric(20,10) DEFAULT 0,
  PRIMARY KEY (user_id, month_eom)
);

CREATE TABLE IF NOT EXISTS portfolio_value_daily_acct (
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  date date NOT NULL,
  total_value numeric(20,10) DEFAULT 0,
  PRIMARY KEY (user_id, account_id, date)
);

-- Perfil do usuário (plano)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text DEFAULT 'free' CHECK (plan IN ('free','premium'))
);


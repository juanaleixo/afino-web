-- Test: Event-driven balance end-to-end smoke test
-- Run as a privileged role (e.g., postgres/supabase_admin) in your Supabase DB.
-- This script will:
-- 1) Pick an existing user from auth.users
-- 2) Set session app.user_id to pass RLS
-- 3) Create a test account and sample assets
-- 4) Insert cash deposit + equity buy events
-- 5) Read back daily positions and aggregates for sanity

BEGIN;

-- 0) Pick a user to run tests under
DO $$
DECLARE v_user uuid;
BEGIN
  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No users found in auth.users. Create a user first.';
  END IF;
  PERFORM set_config('app.user_id', v_user::text, true);
END$$;

-- 1) Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Ensure cash asset (BRL) exists
INSERT INTO public.global_assets(id, symbol, class, currency, manual_price, meta)
SELECT gen_random_uuid(), 'BRL', 'currency', 'BRL', 1, '{"name":"Brazilian Real"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.global_assets WHERE symbol='BRL'
);

-- 3) Create a fresh test account
WITH u AS (
  SELECT current_setting('app.user_id', true)::uuid AS user_id
)
INSERT INTO public.accounts(id, user_id, label, currency)
SELECT gen_random_uuid(), u.user_id, 'Test Account '||to_char(now(),'YYYYMMDDHH24MISS'), 'BRL'
FROM u
RETURNING id INTO TEMP TABLE t_acc(id);

-- 4) Insert cash deposit event
WITH u AS (
  SELECT current_setting('app.user_id', true)::uuid AS user_id
), a AS (
  SELECT id AS asset_id FROM public.global_assets WHERE symbol='BRL'
), acc AS (
  SELECT id AS account_id FROM t_acc
)
INSERT INTO public.events(user_id, account_id, asset_id, tstamp, kind, units_delta, meta)
SELECT u.user_id, acc.account_id, a.asset_id, (CURRENT_DATE - 1)::timestamptz, 'deposit', 1000, '{"test":"cash deposit"}'::jsonb
FROM u, acc, a;

-- 5) Ensure an equity and price history, then buy
WITH maybe AS (
  SELECT id FROM public.global_assets WHERE symbol='ACME3'
), create_equity AS (
  INSERT INTO public.global_assets(id, symbol, class, currency, meta)
  SELECT gen_random_uuid(), 'ACME3', 'equity', 'BRL', '{"name":"Acme S.A."}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM maybe)
  RETURNING id
)
INSERT INTO public.global_price_daily(asset_symbol, date, price)  
SELECT 'TEST_EQUITY', d::date, p
FROM (VALUES
  (CURRENT_DATE - 3, 98.50),
  (CURRENT_DATE - 2, 100.00),
  (CURRENT_DATE - 1, 101.25),
  (CURRENT_DATE,     102.00)
) t(d,p)
ON CONFLICT (asset_id, date) DO NOTHING;

WITH u AS (
  SELECT current_setting('app.user_id', true)::uuid AS user_id
), acc AS (
  SELECT id AS account_id FROM t_acc LIMIT 1
), a AS (
  SELECT id AS asset_id FROM public.global_assets WHERE symbol='ACME3'
)
INSERT INTO public.events(user_id, account_id, asset_id, tstamp, kind, units_delta, price_close, meta)
SELECT u.user_id, acc.account_id, a.asset_id, (CURRENT_DATE - 1)::timestamptz, 'buy', 10, 100.00, '{"test":"equity buy"}'::jsonb
FROM u, acc, a;

-- 6) Ensure partitions for the affected window
SELECT public.ensure_daily_positions_partitions(CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '1 day');

COMMIT;

-- 7) Verification queries (run below)
-- Note: app.user_id remains set for this session

\echo '--- Positions by account (last 4 days) ---'
SELECT date, account_id, asset_id, units, price, value, source_price
FROM public.daily_positions_acct
WHERE user_id = current_setting('app.user_id', true)::uuid
  AND date BETWEEN (CURRENT_DATE - 3) AND CURRENT_DATE
ORDER BY date, account_id, asset_id;

\echo '--- Portfolio daily totals (last 4 days) ---'
SELECT * FROM public.portfolio_value_daily
WHERE user_id = current_setting('app.user_id', true)::uuid
  AND date BETWEEN (CURRENT_DATE - 3) AND CURRENT_DATE
ORDER BY date;

\echo '--- Portfolio monthly totals (last 1 month) ---'
SELECT * FROM public.portfolio_value_monthly
WHERE user_id = current_setting('app.user_id', true)::uuid
  AND month BETWEEN date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date
                 AND date_trunc('month', CURRENT_DATE)::date
ORDER BY month;


-- Seed (optional): Demo data to validate event-driven balances
-- IMPORTANT: Replace the placeholders before running, or set variables.
-- This script assumes you already have a user and an account (FK to auth.users).

BEGIN;

-- PARAMETERS: replace these UUIDs with real ones from your environment
-- Example:
--   WITH vars AS (
--     SELECT '11111111-1111-1111-1111-111111111111'::uuid AS user_id,
--            '22222222-2222-2222-2222-222222222222'::uuid AS account_id
--   )
-- Use below CTE to reference them consistently.

WITH vars AS (
  SELECT '<USER_UUID>'::uuid AS user_id,
         '<ACCOUNT_UUID>'::uuid AS account_id
)
-- Create two assets: BRL currency (price=1) and a stock-like asset
INSERT INTO public.global_assets(id, symbol, class, currency, manual_price, meta)
SELECT gen_random_uuid(), 'BRL', 'currency', 'BRL', 1, '{"name":"Brazilian Real"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.global_assets WHERE symbol='BRL'
);

WITH vars AS (
  SELECT '<USER_UUID>'::uuid AS user_id,
         '<ACCOUNT_UUID>'::uuid AS account_id
), base AS (
  SELECT id AS brl_id FROM public.global_assets WHERE symbol='BRL'
), create_equity AS (
  INSERT INTO public.global_assets(id, symbol, class, currency, meta)
  SELECT gen_random_uuid(), 'ACME3', 'equity', 'BRL', '{"name":"Acme S.A."}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM public.global_assets WHERE symbol='ACME3')
  RETURNING id AS eq_id
)
-- Ensure some price history for ACME3 and BRL
INSERT INTO public.global_price_daily(asset_id, date, price)
SELECT COALESCE((SELECT id FROM public.global_assets WHERE symbol='ACME3'), (SELECT eq_id FROM create_equity)), d, p
FROM (VALUES
  (CURRENT_DATE - 3, 98.50),
  (CURRENT_DATE - 2, 100.00),
  (CURRENT_DATE - 1, 101.25),
  (CURRENT_DATE,     102.00)
) AS t(d, p)
ON CONFLICT (asset_id, date) DO NOTHING;

-- Seed events: deposit BRL, buy ACME3
WITH v AS (
  SELECT '<USER_UUID>'::uuid AS user_id,
         '<ACCOUNT_UUID>'::uuid AS account_id,
         (SELECT id FROM public.global_assets WHERE symbol='BRL')   AS brl_id,
         (SELECT id FROM public.global_assets WHERE symbol='ACME3') AS eq_id
)
INSERT INTO public.events(user_id, account_id, asset_id, tstamp, kind, units_delta, price_close, meta)
SELECT user_id, account_id, brl_id, CURRENT_DATE - 2, 'deposit', 10000, NULL, '{"note":"initial cash"}'::jsonb FROM v
UNION ALL
SELECT user_id, account_id, eq_id,  CURRENT_DATE - 1, 'buy', 50, 100.00, '{"note":"buy shares"}'::jsonb FROM v
ON CONFLICT DO NOTHING;

-- Optionally, a custom valuation for the account/asset on today
WITH v AS (
  SELECT '<ACCOUNT_UUID>'::uuid AS account_id,
         (SELECT id FROM public.global_assets WHERE symbol='ACME3') AS eq_id
)
INSERT INTO public.custom_account_valuations(account_id, asset_id, date, value)
SELECT account_id, eq_id, CURRENT_DATE, 5200.00 FROM v
ON CONFLICT (account_id, asset_id, date) DO NOTHING;

-- Ensure partitions exist for the affected date range
SELECT public.ensure_daily_positions_partitions(CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '1 day');

COMMIT;

-- After running seed, verify results with:
-- SELECT * FROM daily_positions_acct WHERE user_id='<USER_UUID>' ORDER BY date;
-- SELECT * FROM portfolio_value_daily WHERE user_id='<USER_UUID>' ORDER BY date;
-- SELECT * FROM portfolio_value_daily_acct WHERE user_id='<USER_UUID>' ORDER BY date, account_id;
-- SELECT * FROM portfolio_value_monthly WHERE user_id='<USER_UUID>' ORDER BY month;


-- Function: api_events_bundle(date_from, date_to)
-- Description: Consolidated events page data - events, portfolio data, cash data, accounts in one call
-- Reduces events page from 8+ queries to 1 query

CREATE OR REPLACE FUNCTION public.api_events_bundle(
  p_from date DEFAULT (CURRENT_DATE - INTERVAL '7 days')::date, 
  p_to date DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  current_user_id UUID := app_current_user();
  is_premium BOOLEAN := FALSE;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'portfolio_data', '[]'::json,
      'cash_assets', '[]'::json,
      'cash_today', 0,
      'portfolio_today', 0,
      'accounts', '[]'::json,
      'user_context', json_build_object('is_premium', false)
    );
  END IF;

  -- Check premium status
  SELECT (up.subscription_status = 'active' AND (up.premium_expires_at IS NULL OR up.premium_expires_at > now()))
  INTO is_premium
  FROM user_profiles up
  WHERE up.user_id = current_user_id;

  -- Consolidated query
  WITH portfolio_data AS (
    SELECT 
      date,
      total_value
    FROM public.portfolio_value_daily
    WHERE user_id = current_user_id
      AND date BETWEEN p_from AND p_to
    ORDER BY date DESC
  ),
  cash_assets AS (
    SELECT 
      ga.symbol,
      ga.class,
      ga.label_ptbr
    FROM global_assets ga
    WHERE ga.class IN ('currency', 'cash')
  ),
  cash_today AS (
    SELECT COALESCE(SUM(dp.value), 0) as total_cash
    FROM daily_positions_acct dp
    JOIN global_assets ga ON ga.symbol = dp.asset_id::text
    WHERE dp.user_id = current_user_id
      AND dp.date = p_to
      AND ga.class IN ('currency', 'cash')
      AND COALESCE(dp.is_final, true) = true
  ),
  portfolio_today AS (
    SELECT COALESCE(SUM(dp.value), 0) as total_portfolio
    FROM daily_positions_acct dp
    WHERE dp.user_id = current_user_id
      AND dp.date = p_to
      AND COALESCE(dp.is_final, true) = true
  ),
  accounts_data AS (
    SELECT 
      json_agg(json_build_object('id', id, 'label', label)) as accounts
    FROM accounts
    WHERE user_id = current_user_id
  )
  SELECT json_build_object(
    'portfolio_data', COALESCE(
      (SELECT json_agg(json_build_object('date', date, 'total_value', total_value) ORDER BY date DESC) FROM portfolio_data),
      '[]'::json
    ),
    'cash_assets', COALESCE(
      (SELECT json_agg(json_build_object('symbol', symbol, 'class', class, 'label_ptbr', label_ptbr)) FROM cash_assets),
      '[]'::json
    ),
    'cash_today', COALESCE((SELECT total_cash FROM cash_today), 0),
    'portfolio_today', COALESCE((SELECT total_portfolio FROM portfolio_today), 0),
    'accounts', COALESCE((SELECT accounts FROM accounts_data), '[]'::json),
    'user_context', json_build_object(
      'is_premium', COALESCE(is_premium, false)
    )
  )
  INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION public.api_events_bundle(p_from date, p_to date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_events_bundle(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_events_bundle(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_events_bundle(p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_events_bundle(p_from date, p_to date) TO supabase_admin;
-- Function: api_portfolio_bundle(date_from, date_to, date_snapshot)
-- Description: Bundle portfolio data loading - daily series, monthly series, holdings, accounts in one call
-- Optimized for portfolio page loading

CREATE OR REPLACE FUNCTION public.api_portfolio_bundle(
  p_from date, 
  p_to date, 
  p_snapshot date DEFAULT CURRENT_DATE
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
  target_snapshot_date DATE;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'daily_series', '[]'::json,
      'monthly_series', '[]'::json,
      'holdings_at', '[]'::json,
      'holdings_accounts', '[]'::json,
      'has_premium_data', false,
      'snapshot_date', p_snapshot
    );
  END IF;

  -- Check if user is premium (affects what data we return)
  SELECT (up.subscription_status = 'active' AND (up.premium_expires_at IS NULL OR up.premium_expires_at > now()))
  INTO is_premium
  FROM user_profiles up
  WHERE up.user_id = current_user_id;

  is_premium := COALESCE(is_premium, false);

  -- Find the latest available snapshot date
  SELECT MAX(d.date) INTO target_snapshot_date
  FROM public.daily_positions_acct d
  WHERE d.user_id = current_user_id
    AND d.date <= p_snapshot
    AND COALESCE(d.is_final, true) = true;

  IF target_snapshot_date IS NULL THEN
    target_snapshot_date := p_snapshot;
  END IF;

  -- Build consolidated portfolio data
  WITH daily_data AS (
    -- Daily series (premium feature)
    SELECT CASE WHEN is_premium THEN
      json_agg(
        json_build_object(
          'date', pvd.date,
          'total_value', pvd.total_value
        )
        ORDER BY pvd.date
      )
    ELSE '[]'::json END as daily_series
    FROM public.portfolio_value_daily pvd
    WHERE pvd.user_id = current_user_id
      AND pvd.date BETWEEN p_from AND p_to
      AND is_premium -- Only load if premium
  ),
  monthly_data AS (
    -- Monthly series (available for all users)
    SELECT json_agg(
      json_build_object(
        'month_eom', pvm.month,
        'total_value', pvm.month_value
      )
      ORDER BY pvm.month
    ) as monthly_series
    FROM public.portfolio_value_monthly pvm
    WHERE pvm.user_id = current_user_id
      AND pvm.month BETWEEN p_from AND p_to
  ),
  holdings_snapshot AS (
    -- Holdings at snapshot date
    SELECT json_agg(
      json_build_object(
        'asset_id', dp.asset_id::text,
        'symbol', COALESCE(ga.symbol, ca.symbol, dp.asset_id::text),
        'class', COALESCE(ga.class, ca.class, 'unknown'),
        'label_ptbr', COALESCE(ga.label_ptbr, ca.label),
        'units', SUM(dp.units),
        'value', SUM(dp.value)
      )
      ORDER BY SUM(dp.value) DESC
    ) as holdings
    FROM public.daily_positions_acct dp
    LEFT JOIN public.global_assets ga ON ga.symbol = dp.asset_id::text
    LEFT JOIN public.custom_assets ca ON ca.id::text = dp.asset_id::text AND ca.user_id = current_user_id
    WHERE dp.user_id = current_user_id
      AND dp.date = target_snapshot_date
      AND COALESCE(dp.is_final, true) = true
    GROUP BY dp.asset_id, ga.symbol, ga.class, ga.label_ptbr, ca.symbol, ca.class, ca.label
    HAVING SUM(dp.value) > 0.01
  ),
  holdings_by_account AS (
    -- Holdings by account (premium feature)
    SELECT CASE WHEN is_premium THEN
      json_agg(
        json_build_object(
          'account_id', dp.account_id,
          'asset_id', dp.asset_id::text,
          'symbol', COALESCE(ga.symbol, ca.symbol, dp.asset_id::text),
          'units', SUM(dp.units),
          'value', SUM(dp.value)
        )
        ORDER BY dp.account_id, SUM(dp.value) DESC
      )
    ELSE '[]'::json END as holdings_accounts
    FROM public.daily_positions_acct dp
    LEFT JOIN public.global_assets ga ON ga.symbol = dp.asset_id::text
    LEFT JOIN public.custom_assets ca ON ca.id::text = dp.asset_id::text AND ca.user_id = current_user_id
    WHERE dp.user_id = current_user_id
      AND dp.date = target_snapshot_date
      AND COALESCE(dp.is_final, true) = true
      AND is_premium -- Only load if premium
    GROUP BY dp.account_id, dp.asset_id, ga.symbol, ca.symbol
    HAVING SUM(dp.value) > 0.01
  )
  SELECT json_build_object(
    'daily_series', COALESCE(dd.daily_series, '[]'::json),
    'monthly_series', COALESCE(md.monthly_series, '[]'::json),
    'holdings_at', COALESCE(hs.holdings, '[]'::json),
    'holdings_accounts', COALESCE(hba.holdings_accounts, '[]'::json),
    'has_premium_data', is_premium,
    'snapshot_date', target_snapshot_date
  )
  INTO result
  FROM daily_data dd
  CROSS JOIN monthly_data md
  CROSS JOIN holdings_snapshot hs
  CROSS JOIN holdings_by_account hba;

  RETURN result;
END;
$$;

ALTER FUNCTION public.api_portfolio_bundle(p_from date, p_to date, p_snapshot date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_portfolio_bundle(p_from date, p_to date, p_snapshot date) TO anon;
GRANT ALL ON FUNCTION public.api_portfolio_bundle(p_from date, p_to date, p_snapshot date) TO authenticated;
GRANT ALL ON FUNCTION public.api_portfolio_bundle(p_from date, p_to date, p_snapshot date) TO service_role;
GRANT ALL ON FUNCTION public.api_portfolio_bundle(p_from date, p_to date, p_snapshot date) TO supabase_admin;
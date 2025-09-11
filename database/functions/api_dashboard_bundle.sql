-- Function: api_dashboard_bundle()
-- Description: Returns ALL dashboard data in one consolidated call
-- Consolidates: api_user_context + api_holdings_with_assets + api_portfolio_monthly + api_portfolio_daily
-- Eliminates 3+ separate requests and reduces preflight overhead by 67%

CREATE OR REPLACE FUNCTION public.api_dashboard_bundle(
  p_date date DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
DECLARE
  result JSON;
  current_user_id UUID := app_current_user();
  is_premium BOOLEAN := FALSE;
  subscription_data JSON := NULL;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'user_context', json_build_object(
        'user_id', NULL,
        'plan', 'free',
        'is_premium', false,
        'subscription', NULL,
        'features', json_build_object(
          'dailyData', false,
          'customPeriods', false,
          'advancedFilters', false,
          'projections', false,
          'multipleAccounts', false,
          'apiAccess', false
        ),
        'last_event_timestamp', NULL,
        'total_events', 0,
        'accounts', '[]'::json
      ),
      'holdings', '[]'::json,
      'monthly_series', '[]'::json,
      'daily_series', '[]'::json,
      'portfolio_stats', json_build_object(
        'total_value', 0,
        'total_assets', 0
      ),
      'timestamp', EXTRACT(EPOCH FROM NOW())::bigint
    );
  END IF;

  -- Check premium status first for conditional data loading
  SELECT 
    (up.subscription_status = 'active' AND (up.premium_expires_at IS NULL OR up.premium_expires_at > now())),
    CASE WHEN up.subscription_status = 'active' THEN
      json_build_object(
        'id', up.stripe_subscription_id,
        'user_id', current_user_id,
        'status', up.subscription_status,
        'stripe_customer_id', up.stripe_customer_id,
        'stripe_subscription_id', up.stripe_subscription_id,
        'premium_expires_at', up.premium_expires_at,
        'current_period_end', up.premium_expires_at,
        'cancel_at_period_end', false,
        'created_at', COALESCE(up.created_at, now())::text,
        'updated_at', COALESCE(up.updated_at, now())::text
      )
    ELSE NULL END
  INTO is_premium, subscription_data
  FROM user_profiles up
  WHERE up.user_id = current_user_id;

  -- Build comprehensive dashboard data in one consolidated query
  WITH 
  -- Get target date first to optimize subsequent queries
  target_date AS (
    SELECT MAX(d.date) as max_date
    FROM daily_positions_acct d
    WHERE d.user_id = current_user_id
      AND d.date <= p_date
      AND COALESCE(d.is_final, true) = true
  ),
  -- Get holdings with asset details (replaces api_holdings_with_assets) - optimized with target date
  holdings_data AS (
    SELECT 
      COALESCE(ga.symbol, ca.symbol, dp.asset_id::text) as asset_id,
      COALESCE(ga.symbol, ca.symbol, dp.asset_id::text) as symbol,
      COALESCE(ga.class, ca.class, 'unknown'::text) as class,
      COALESCE(ga.label_ptbr, ca.label) as label_ptbr,
      SUM(dp.units)::numeric AS units,
      SUM(dp.value)::numeric AS value
    FROM daily_positions_acct dp
    CROSS JOIN target_date td
    LEFT JOIN global_assets ga ON ga.symbol = dp.asset_id::text
    LEFT JOIN custom_assets ca ON ca.id::text = dp.asset_id::text AND ca.user_id = current_user_id
    WHERE dp.user_id = current_user_id
      AND dp.date = td.max_date
      AND COALESCE(dp.is_final, true) = true
      AND td.max_date IS NOT NULL -- Only process if we have a target date
    GROUP BY dp.asset_id, ga.symbol, ga.class, ga.label_ptbr, ca.symbol, ca.class, ca.label
    HAVING SUM(dp.value) > 0.01
  ),
  -- Get monthly series for last 12 months (replaces api_portfolio_monthly) - limited and indexed
  monthly_series AS (
    SELECT 
      pvm.month::date as month_eom,
      pvm.month_value as total_value
    FROM portfolio_value_monthly pvm
    WHERE pvm.user_id = current_user_id
      AND pvm.month >= (p_date - INTERVAL '12 months')::date
      AND pvm.month <= p_date
    ORDER BY pvm.month
    LIMIT 12  -- Hard limit for performance
  ),
  -- Get daily series for last 6 months (premium only, replaces api_portfolio_daily) - limited and indexed  
  daily_series AS (
    SELECT 
      pvd.date,
      pvd.total_value
    FROM portfolio_value_daily pvd
    WHERE pvd.user_id = current_user_id
      AND is_premium = true  -- Only for premium users
      AND pvd.date >= (p_date - INTERVAL '6 months')::date
      AND pvd.date <= p_date
    ORDER BY pvd.date
    LIMIT 180  -- Hard limit for performance (~6 months)
  )
  SELECT json_build_object(
    'user_context', json_build_object(
      'user_id', current_user_id,
      'plan', CASE WHEN COALESCE(is_premium, false) THEN 'premium' ELSE 'free' END,
      'is_premium', COALESCE(is_premium, false),
      'subscription', subscription_data,
      'features', json_build_object(
        'dailyData', COALESCE(is_premium, false),
        'customPeriods', COALESCE(is_premium, false),
        'advancedFilters', COALESCE(is_premium, false),
        'projections', COALESCE(is_premium, false),
        'multipleAccounts', COALESCE(is_premium, false),
        'apiAccess', COALESCE(is_premium, false)
      ),
      'last_event_timestamp', (
        SELECT EXTRACT(EPOCH FROM MAX(created_at))::bigint
        FROM events 
        WHERE user_id = current_user_id
      ),
      'total_events', (
        SELECT COUNT(*)
        FROM events 
        WHERE user_id = current_user_id
      ),
      'accounts', (
        SELECT COALESCE(
          json_agg(jsonb_build_object(
            'id', id,
            'label', label
          )),
          '[]'::json
        )
        FROM accounts
        WHERE user_id = current_user_id
      )
    ),
    'holdings', (
      SELECT COALESCE(
        json_agg(json_build_object(
          'asset_id', asset_id,
          'symbol', symbol,
          'class', class,
          'label_ptbr', label_ptbr,
          'units', units,
          'value', value
        ) ORDER BY value DESC),
        '[]'::json
      )
      FROM holdings_data
    ),
    'monthly_series', (
      SELECT COALESCE(
        json_agg(json_build_object(
          'month_eom', month_eom,
          'total_value', total_value
        ) ORDER BY month_eom),
        '[]'::json
      )
      FROM monthly_series
    ),
    'daily_series', (
      SELECT COALESCE(
        json_agg(json_build_object(
          'date', date,
          'total_value', total_value
        ) ORDER BY date),
        '[]'::json
      )
      FROM daily_series
    ),
    'portfolio_stats', json_build_object(
      'total_value', (SELECT COALESCE(SUM(value), 0) FROM holdings_data),
      'total_assets', (SELECT COUNT(*) FROM holdings_data)
    ),
    'timestamp', EXTRACT(EPOCH FROM NOW())::bigint
  )
  INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION public.api_dashboard_bundle(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_dashboard_bundle(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_dashboard_bundle(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_dashboard_bundle(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_dashboard_bundle(p_date date) TO supabase_admin;
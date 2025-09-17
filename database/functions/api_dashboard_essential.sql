-- Function: api_dashboard_essential()
-- Description: Returns ESSENTIAL dashboard data quickly - user context + basic holdings
-- Fast version for initial load, then load charts separately

CREATE OR REPLACE FUNCTION public.api_dashboard_essential(
  p_date date DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '3s'
AS $$
DECLARE
  result JSON;
  current_user_id UUID := app_current_user();
  is_premium BOOLEAN := FALSE;
  subscription_data JSON := NULL;
  target_date DATE;
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

  -- Find the latest available date <= p_date for holdings (optimized with limit)
  SELECT d.date INTO target_date
  FROM public.daily_positions_acct d
  WHERE d.user_id = current_user_id
    AND d.date <= p_date
    AND COALESCE(d.is_final, true) = true
  ORDER BY d.date DESC
  LIMIT 1;

  -- Return early if no target_date (no data available)
  IF target_date IS NULL THEN
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
        'last_event_timestamp', NULL,
        'total_events', 0,
        'accounts', '[]'::json
      ),
      'holdings', '[]'::json,
      'portfolio_stats', json_build_object(
        'total_value', 0,
        'total_assets', 0
      ),
      'timestamp', EXTRACT(EPOCH FROM NOW())::bigint,
      'target_date', NULL
    ) INTO result;
    RETURN result;
  END IF;

  -- Build essential dashboard data with optimized holdings query
  WITH 
  -- Get holdings with asset details (fast version - only current holdings)
  holdings_data AS (
    SELECT 
      COALESCE(ga.symbol, ca.symbol, dp.asset_id::text) as asset_id,
      COALESCE(ga.symbol, ca.symbol, dp.asset_id::text) as symbol,
      COALESCE(ga.class, ca.class, 'unknown'::text) as class,
      COALESCE(ga.label_ptbr, ca.label) as label_ptbr,
      SUM(dp.units)::numeric AS units,
      SUM(dp.value)::numeric AS value
    FROM daily_positions_acct dp
    LEFT JOIN global_assets ga ON ga.symbol = dp.asset_id::text
    LEFT JOIN custom_assets ca ON ca.id::text = dp.asset_id::text AND ca.user_id = current_user_id
    WHERE dp.user_id = current_user_id
      AND dp.date = target_date
      AND COALESCE(dp.is_final, true) = true
    GROUP BY dp.asset_id, ga.symbol, ga.class, ga.label_ptbr, ca.symbol, ca.class, ca.label
    HAVING SUM(dp.value) > 0.01
    ORDER BY SUM(dp.value) DESC
    LIMIT 50  -- Limit holdings for fast loading
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
        LIMIT 1
      ),
      'total_events', (
        SELECT COUNT(*)
        FROM events 
        WHERE user_id = current_user_id
        LIMIT 10000  -- Reasonable limit to prevent timeouts
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
    'portfolio_stats', json_build_object(
      'total_value', (SELECT COALESCE(SUM(value), 0) FROM holdings_data),
      'total_assets', (SELECT COUNT(*) FROM holdings_data)
    ),
    'timestamp', EXTRACT(EPOCH FROM NOW())::bigint,
    'target_date', target_date
  )
  INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION public.api_dashboard_essential(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_dashboard_essential(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_dashboard_essential(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_dashboard_essential(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_dashboard_essential(p_date date) TO supabase_admin;
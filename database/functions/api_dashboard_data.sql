-- Function: api_dashboard_data(date)
-- Description: Consolidated dashboard data loader - reduces multiple queries to single call
-- Returns: portfolio stats, holdings, accounts, user context in one optimized query

CREATE OR REPLACE FUNCTION public.api_dashboard_data(p_date date DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  current_user_id UUID := app_current_user();
  target_date DATE;
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
        )
      ),
      'portfolio_stats', json_build_object(
        'total_value', 0,
        'total_assets', 0,
        'date', p_date,
        'has_data', false
      ),
      'holdings', '[]'::json,
      'accounts', '[]'::json,
      'timeline_preview', '[]'::json
    );
  END IF;

  -- Check premium status once
  SELECT 
    (up.subscription_status = 'active' AND (up.premium_expires_at IS NULL OR up.premium_expires_at > now())),
    CASE WHEN up.subscription_status = 'active' THEN
      json_build_object(
        'status', up.subscription_status,
        'stripe_customer_id', up.stripe_customer_id,
        'stripe_subscription_id', up.stripe_subscription_id,
        'premium_expires_at', up.premium_expires_at
      )
    ELSE NULL END
  INTO is_premium, subscription_data
  FROM user_profiles up
  WHERE up.user_id = current_user_id;

  -- Find the latest available date for positions
  SELECT MAX(d.date) INTO target_date
  FROM public.daily_positions_acct d
  WHERE d.user_id = current_user_id
    AND d.date <= p_date
    AND COALESCE(d.is_final, true) = true;

  IF target_date IS NULL THEN
    target_date := p_date;
  END IF;

  -- Simplified consolidated query
  WITH summary_data AS (
    SELECT
      -- Portfolio stats
      COALESCE(SUM(dp.value), 0) as total_value,
      COUNT(DISTINCT dp.asset_id) as total_assets,
      target_date as date,
      COUNT(*) > 0 as has_data,
      
      -- Holdings data
      json_agg(
        json_build_object(
          'asset_id', dp.asset_id::text,
          'symbol', COALESCE(ga.symbol, ca.symbol, dp.asset_id::text),
          'class', COALESCE(ga.class, ca.class, 'unknown'),
          'label_ptbr', COALESCE(ga.label_ptbr, ca.label),
          'units', SUM(dp.units),
          'value', SUM(dp.value)
        )
        ORDER BY SUM(dp.value) DESC
      ) FILTER (WHERE SUM(dp.value) > 0.01) as holdings
      
    FROM public.daily_positions_acct dp
    LEFT JOIN public.global_assets ga ON ga.symbol = dp.asset_id::text
    LEFT JOIN public.custom_assets ca ON ca.id::text = dp.asset_id::text AND ca.user_id = current_user_id
    WHERE dp.user_id = current_user_id
      AND dp.date = target_date
      AND COALESCE(dp.is_final, true) = true
    GROUP BY dp.asset_id, ga.symbol, ga.class, ga.label_ptbr, ca.symbol, ca.class, ca.label
  )
  SELECT json_build_object(
    'user_context', json_build_object(
      'user_id', current_user_id,
      'plan', CASE WHEN is_premium THEN 'premium' ELSE 'free' END,
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
      'last_event_timestamp', (SELECT EXTRACT(EPOCH FROM MAX(created_at))::bigint FROM events WHERE user_id = current_user_id),
      'total_events', (SELECT COUNT(*) FROM events WHERE user_id = current_user_id),
      'accounts', (SELECT COALESCE(json_agg(json_build_object('id', id, 'label', label)), '[]'::json) FROM accounts WHERE user_id = current_user_id)
    ),
    'portfolio_stats', json_build_object(
      'total_value', sd.total_value,
      'total_assets', sd.total_assets,
      'date', sd.date,
      'has_data', sd.has_data
    ),
    'holdings', COALESCE(sd.holdings, '[]'::json),
    'timeline_preview', (
      SELECT COALESCE(
        json_agg(json_build_object('date', date, 'total_value', total_value) ORDER BY date DESC), 
        '[]'::json
      )
      FROM public.portfolio_value_daily 
      WHERE user_id = current_user_id 
        AND date >= (CURRENT_DATE - INTERVAL '30 days')
      LIMIT 7
    )
  )
  INTO result
  FROM summary_data sd;

  RETURN result;
END;
$$;

ALTER FUNCTION public.api_dashboard_data(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_dashboard_data(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_dashboard_data(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_dashboard_data(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_dashboard_data(p_date date) TO supabase_admin;
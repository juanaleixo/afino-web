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

  -- Build consolidated result with all dashboard data
  WITH portfolio_summary AS (
    SELECT
      COALESCE(SUM(dp.value), 0) as total_value,
      COUNT(DISTINCT dp.asset_id) as total_assets,
      target_date as date,
      CASE WHEN COUNT(*) > 0 THEN true ELSE false END as has_data
    FROM public.daily_positions_acct dp
    WHERE dp.user_id = current_user_id
      AND dp.date = target_date
      AND COALESCE(dp.is_final, true) = true
      AND dp.value > 0.01
  ),
  holdings_data AS (
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
      AND dp.date = target_date
      AND COALESCE(dp.is_final, true) = true
    GROUP BY dp.asset_id, ga.symbol, ga.class, ga.label_ptbr, ca.symbol, ca.class, ca.label
    HAVING SUM(dp.value) > 0.01
  ),
  accounts_data AS (
    SELECT json_agg(
      json_build_object(
        'id', a.id,
        'label', a.label
      )
      ORDER BY a.created_at
    ) as accounts
    FROM accounts a
    WHERE a.user_id = current_user_id
  ),
  events_data AS (
    SELECT 
      COUNT(*) as total_events,
      EXTRACT(EPOCH FROM MAX(created_at))::bigint as last_event_timestamp
    FROM events e
    WHERE e.user_id = current_user_id
  ),
  timeline_preview AS (
    SELECT json_agg(
      json_build_object(
        'date', pvd.date,
        'total_value', pvd.total_value
      )
      ORDER BY pvd.date DESC
    ) as timeline_data
    FROM public.portfolio_value_daily pvd
    WHERE pvd.user_id = current_user_id
      AND pvd.date >= (CURRENT_DATE - INTERVAL '30 days')
    LIMIT 7
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
      'last_event_timestamp', ed.last_event_timestamp,
      'total_events', ed.total_events,
      'accounts', COALESCE(ad.accounts, '[]'::json)
    ),
    'portfolio_stats', json_build_object(
      'total_value', ps.total_value,
      'total_assets', ps.total_assets,
      'date', ps.date,
      'has_data', ps.has_data
    ),
    'holdings', COALESCE(hd.holdings, '[]'::json),
    'accounts', COALESCE(ad.accounts, '[]'::json),
    'timeline_preview', COALESCE(tp.timeline_data, '[]'::json)
  )
  INTO result
  FROM portfolio_summary ps
  CROSS JOIN holdings_data hd
  CROSS JOIN accounts_data ad
  CROSS JOIN events_data ed
  CROSS JOIN timeline_preview tp;

  RETURN result;
END;
$$;

ALTER FUNCTION public.api_dashboard_data(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_dashboard_data(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_dashboard_data(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_dashboard_data(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_dashboard_data(p_date date) TO supabase_admin;
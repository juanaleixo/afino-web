-- Function: api_dashboard_essential()
-- Description: Returns lightweight dashboard data with separate endpoints approach
-- Frontend will call multiple lighter endpoints instead of heavy json_agg

CREATE OR REPLACE FUNCTION public.api_dashboard_essential(
  p_date date DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '5s'
AS $$
DECLARE
  result JSON;
  current_user_id UUID := app_current_user();
  is_premium BOOLEAN := FALSE;
  subscription_data JSON := NULL;
  target_date DATE;
  total_value NUMERIC := 0;
  total_assets INTEGER := 0;
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
        'accounts_count', 0
      ),
      'portfolio_stats', json_build_object(
        'total_value', 0,
        'total_assets', 0
      ),
      'timestamp', EXTRACT(EPOCH FROM NOW())::bigint,
      'target_date', NULL,
      'has_holdings_data', false
    );
  END IF;

  -- Get user profile data first
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

  -- Find latest available date
  SELECT d.date INTO target_date
  FROM daily_positions_acct d
  WHERE d.user_id = current_user_id
    AND d.date <= p_date
    AND COALESCE(d.is_final, true) = true
  ORDER BY d.date DESC
  LIMIT 1;

  -- Get portfolio stats only (without holdings data)
  IF target_date IS NOT NULL THEN
    SELECT
      COALESCE(SUM(dp.value), 0),
      COUNT(DISTINCT dp.asset_id)
    INTO total_value, total_assets
    FROM daily_positions_acct dp
    WHERE dp.user_id = current_user_id
      AND dp.date = target_date
      AND COALESCE(dp.is_final, true) = true
      AND dp.value > 0.01;
  END IF;

  -- Build lightweight result
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
        SELECT COUNT(*)::integer
        FROM events
        WHERE user_id = current_user_id
        LIMIT 10000
      ),
      'accounts_count', (
        SELECT COUNT(*)::integer
        FROM accounts
        WHERE user_id = current_user_id
      )
    ),
    'portfolio_stats', json_build_object(
      'total_value', total_value,
      'total_assets', total_assets
    ),
    'timestamp', EXTRACT(EPOCH FROM NOW())::bigint,
    'target_date', target_date,
    'has_holdings_data', (target_date IS NOT NULL AND total_assets > 0)
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
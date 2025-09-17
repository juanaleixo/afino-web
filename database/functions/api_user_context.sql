-- Function: api_user_context()
-- Description: Returns all user context data in one call to reduce multiple queries

CREATE OR REPLACE FUNCTION public.api_user_context()
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
  subscription_data JSON := NULL;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
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
    );
  END IF;

  -- SECURITY: Enhanced premium validation with multiple security checks
  SELECT 
    (up.subscription_status = 'active' OR up.subscription_status = 'trialing') 
    AND (up.premium_expires_at IS NULL OR up.premium_expires_at > now())
    AND up.stripe_customer_id IS NOT NULL 
    AND up.stripe_subscription_id IS NOT NULL
    AND up.stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'  -- Valid Stripe customer ID format
    AND up.stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$', -- Valid Stripe subscription ID format
    CASE WHEN (
      (up.subscription_status = 'active' OR up.subscription_status = 'trialing')
      AND (up.premium_expires_at IS NULL OR up.premium_expires_at > now())
      AND up.stripe_customer_id IS NOT NULL
      AND up.stripe_subscription_id IS NOT NULL
    ) THEN
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

  -- Build complete user context (separating events and accounts queries)
  SELECT json_build_object(
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
    'accounts_count', (
      SELECT COUNT(*)::integer
      FROM accounts
      WHERE user_id = current_user_id
    )
  )
  INTO result;

  -- Ensure we always return a result
  IF result IS NULL THEN
    SELECT json_build_object(
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
      'last_event_timestamp', NULL,
      'total_events', 0,
      'accounts_count', (
        SELECT COUNT(*)::integer
        FROM accounts a
        WHERE a.user_id = current_user_id
      )
    ) INTO result;
  END IF;

  RETURN result;
END;
$$;

ALTER FUNCTION public.api_user_context() OWNER TO postgres;

-- SECURITY: Restricted permissions - only authenticated users can execute this function
-- Anonymous users should not have access to user context data
REVOKE ALL ON FUNCTION public.api_user_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_user_context() FROM anon;

-- Grant minimal required permissions
GRANT EXECUTE ON FUNCTION public.api_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_user_context() TO service_role;
GRANT EXECUTE ON FUNCTION public.api_user_context() TO supabase_admin;
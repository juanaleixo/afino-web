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
      'accounts', '[]'::json
    );
  END IF;

  -- Check if user is premium and get subscription data
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

  -- Build complete user context
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
    'last_event_timestamp', EXTRACT(EPOCH FROM MAX(e.created_at))::bigint,
    'total_events', COUNT(e.id),
    'accounts', COALESCE(
      json_agg(DISTINCT jsonb_build_object(
        'id', a.id,
        'label', a.label
      )) FILTER (WHERE a.id IS NOT NULL),
      '[]'::json
    )
  )
  INTO result
  FROM events e
  FULL OUTER JOIN accounts a ON a.user_id = current_user_id
  WHERE e.user_id = current_user_id OR e.user_id IS NULL
  GROUP BY current_user_id;

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
      'accounts', (
        SELECT COALESCE(
          json_agg(jsonb_build_object(
            'id', a.id,
            'label', a.label
          )),
          '[]'::json
        )
        FROM accounts a
        WHERE a.user_id = current_user_id
      )
    ) INTO result;
  END IF;

  RETURN result;
END;
$$;

ALTER FUNCTION public.api_user_context() OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_user_context() TO anon;
GRANT ALL ON FUNCTION public.api_user_context() TO authenticated;
GRANT ALL ON FUNCTION public.api_user_context() TO service_role;
GRANT ALL ON FUNCTION public.api_user_context() TO supabase_admin;
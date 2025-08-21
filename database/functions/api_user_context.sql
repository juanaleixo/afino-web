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
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'user_id', NULL,
      'plan', 'free',
      'last_event_timestamp', NULL,
      'total_events', 0,
      'accounts', '[]'::json
    );
  END IF;

  SELECT json_build_object(
    'user_id', current_user_id,
    'plan', COALESCE(up.plan, 'free'),
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
  FROM user_profiles up
  LEFT JOIN events e ON e.user_id = current_user_id
  LEFT JOIN accounts a ON a.user_id = current_user_id
  WHERE up.user_id = current_user_id
  GROUP BY up.user_id, up.plan;

  -- If no user profile exists, return default
  IF result IS NULL THEN
    SELECT json_build_object(
      'user_id', current_user_id,
      'plan', 'free',
      'last_event_timestamp', NULL,
      'total_events', 0,
      'accounts', '[]'::json
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
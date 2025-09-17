-- Function: api_dashboard_timeline()
-- Description: Returns timeline data as separate table functions for lighter queries
-- Frontend processes the tabular data instead of json_agg

CREATE OR REPLACE FUNCTION public.api_dashboard_timeline(
  p_date date DEFAULT CURRENT_DATE,
  p_is_premium boolean DEFAULT false
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
  monthly_count INTEGER := 0;
  daily_count INTEGER := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'monthly_count', 0,
      'daily_count', 0,
      'has_data', false,
      'timestamp', EXTRACT(EPOCH FROM NOW())::bigint
    );
  END IF;

  -- Get counts only (not actual data)
  SELECT COUNT(*) INTO monthly_count
  FROM portfolio_value_monthly pvm
  WHERE pvm.user_id = current_user_id
    AND pvm.month >= (p_date - INTERVAL '12 months')::date
    AND pvm.month <= p_date;

  -- Get daily count only if premium
  IF p_is_premium THEN
    SELECT COUNT(*) INTO daily_count
    FROM portfolio_value_daily pvd
    WHERE pvd.user_id = current_user_id
      AND pvd.date >= (p_date - INTERVAL '6 months')::date
      AND pvd.date <= p_date;
  END IF;

  -- Return lightweight response
  SELECT json_build_object(
    'monthly_count', monthly_count,
    'daily_count', daily_count,
    'has_data', (monthly_count > 0 OR daily_count > 0),
    'timestamp', EXTRACT(EPOCH FROM NOW())::bigint
  )
  INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION public.api_dashboard_timeline(p_date date, p_is_premium boolean) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_dashboard_timeline(p_date date, p_is_premium boolean) TO anon;
GRANT ALL ON FUNCTION public.api_dashboard_timeline(p_date date, p_is_premium boolean) TO authenticated;
GRANT ALL ON FUNCTION public.api_dashboard_timeline(p_date date, p_is_premium boolean) TO service_role;
GRANT ALL ON FUNCTION public.api_dashboard_timeline(p_date date, p_is_premium boolean) TO supabase_admin;
-- Function: api_dashboard_timeline()
-- Description: Returns ONLY timeline data (monthly/daily series) for charts
-- Fast separate load for chart data after essential dashboard loads

CREATE OR REPLACE FUNCTION public.api_dashboard_timeline(
  p_date date DEFAULT CURRENT_DATE,
  p_is_premium boolean DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '8s'
AS $$
DECLARE
  result JSON;
  current_user_id UUID := app_current_user();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'monthly_series', '[]'::json,
      'daily_series', '[]'::json,
      'timestamp', EXTRACT(EPOCH FROM NOW())::bigint
    );
  END IF;

  -- Build timeline data with optimized queries
  WITH 
  -- Get monthly series for last 12 months (limited and indexed)
  monthly_series AS (
    SELECT 
      pvm.month::date as month_eom,
      pvm.month_value as total_value
    FROM portfolio_value_monthly pvm
    WHERE pvm.user_id = current_user_id
      AND pvm.month >= (p_date - INTERVAL '12 months')::date
      AND pvm.month <= p_date
    ORDER BY pvm.month DESC
    LIMIT 12  -- Hard limit for performance
  ),
  -- Get daily series for last 6 months (premium only, limited and indexed)  
  daily_series AS (
    SELECT 
      pvd.date,
      pvd.total_value
    FROM portfolio_value_daily pvd
    WHERE pvd.user_id = current_user_id
      AND p_is_premium = true  -- Only for premium users
      AND pvd.date >= (p_date - INTERVAL '6 months')::date
      AND pvd.date <= p_date
    ORDER BY pvd.date DESC
    LIMIT 180  -- Hard limit for performance (~6 months)
  )
  SELECT json_build_object(
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
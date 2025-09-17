-- Function: api_portfolio_monthly(date, date)
-- Description: Returns monthly portfolio value - optimized for performance

CREATE OR REPLACE FUNCTION public.api_portfolio_monthly(p_from date, p_to date)
RETURNS TABLE(month_eom date, total_value numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '3s'
AS $$
  SELECT
    m.month AS month_eom,
    m.month_value AS total_value
  FROM portfolio_value_monthly m
  WHERE m.user_id = app_current_user()
    AND m.month >= p_from
    AND m.month <= p_to
  ORDER BY m.month DESC
  LIMIT 24;  -- Max 2 years for performance
$$;

ALTER FUNCTION public.api_portfolio_monthly(p_from date, p_to date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO supabase_admin;

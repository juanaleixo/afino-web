-- Function: api_portfolio_monthly(date, date)
-- Description: Returns the monthly portfolio value for a given date range.

CREATE FUNCTION public.api_portfolio_monthly(p_from date, p_to date) RETURNS TABLE(month_eom date, total_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT m.month_eom, m.total_value
FROM public.portfolio_value_monthly m
WHERE m.user_id = app_current_user()
AND m.month_eom BETWEEN p_from AND p_to
ORDER BY m.month_eom;
$$;

ALTER FUNCTION public.api_portfolio_monthly(p_from date, p_to date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO supabase_admin;

-- Function: api_portfolio_daily(date, date)
-- Description: Returns the daily portfolio value for a given date range.

CREATE FUNCTION public.api_portfolio_daily(p_from date, p_to date) RETURNS TABLE(date date, total_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT d.date, d.total_value
FROM public.portfolio_value_daily d
WHERE d.user_id = app_current_user()
AND d.date BETWEEN p_from AND p_to
ORDER BY d.date;
$$;

ALTER FUNCTION public.api_portfolio_daily(p_from date, p_to date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_portfolio_daily(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_portfolio_daily(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_portfolio_daily(p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_portfolio_daily(p_from date, p_to date) TO supabase_admin;

-- Function: api_portfolio_daily_accounts(date, date)
-- Description: Returns the daily portfolio value for each account in a given date range.

CREATE FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) RETURNS TABLE(date date, account_id uuid, total_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT date, account_id, total_value
FROM portfolio_value_daily_acct
WHERE user_id = app_current_user()
AND date BETWEEN p_from AND p_to
ORDER BY date, account_id;
$$;

ALTER FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) TO supabase_admin;

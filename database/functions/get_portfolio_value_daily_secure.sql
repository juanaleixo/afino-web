-- Function: get_portfolio_value_daily_secure()
-- Description: Returns the daily portfolio value for the current user.

CREATE FUNCTION public.get_portfolio_value_daily_secure() RETURNS TABLE(user_id uuid, date date, total_value numeric)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
RETURN QUERY
SELECT p.user_id, p.date, p.total_value
FROM portfolio_value_daily p
WHERE p.user_id = auth.uid();
END;
$$;

ALTER FUNCTION public.get_portfolio_value_daily_secure() OWNER TO postgres;

GRANT ALL ON FUNCTION public.get_portfolio_value_daily_secure() TO anon;
GRANT ALL ON FUNCTION public.get_portfolio_value_daily_secure() TO authenticated;
GRANT ALL ON FUNCTION public.get_portfolio_value_daily_secure() TO service_role;
GRANT ALL ON FUNCTION public.get_portfolio_value_daily_secure() TO supabase_admin;

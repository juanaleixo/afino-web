-- Function: api_holdings_accounts(date)
-- Description: Returns the holdings for each account on a given date.

CREATE FUNCTION public.api_holdings_accounts(p_date date) RETURNS TABLE(account_id uuid, asset_id uuid, units numeric, value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT
dp.account_id,
dp.asset_id,
dp.units,
dp.value
FROM public.daily_positions_acct dp
WHERE dp.user_id = app_current_user()
AND dp.date = p_date
ORDER BY dp.account_id, dp.asset_id;
$$;

ALTER FUNCTION public.api_holdings_accounts(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO supabase_admin;

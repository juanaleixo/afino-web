-- Function: api_holdings_at(date)
-- Description: Returns the holdings for a given date.

CREATE FUNCTION public.api_holdings_at(p_date date) RETURNS TABLE(asset_id uuid, units numeric, value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT
dp.asset_id,
SUM(dp.units)::numeric AS units,
SUM(dp.value)::numeric AS value
FROM public.daily_positions_acct dp
WHERE dp.user_id = app_current_user()
AND dp.date = p_date
GROUP BY dp.asset_id
ORDER BY dp.asset_id;
$$;

ALTER FUNCTION public.api_holdings_at(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO supabase_admin;

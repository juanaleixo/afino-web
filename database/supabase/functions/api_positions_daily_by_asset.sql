-- Function: api_positions_daily_by_asset(uuid, date, date)
-- Description: Returns the daily positions for a given asset in a given date range.

CREATE FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) RETURNS TABLE(date date, units numeric, value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT date, SUM(units)::numeric, SUM(value)::numeric
FROM daily_positions_acct
WHERE user_id = app_current_user()
AND asset_id = p_asset
AND date BETWEEN p_from AND p_to
GROUP BY date
ORDER BY date;
$$;

ALTER FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) TO supabase_admin;

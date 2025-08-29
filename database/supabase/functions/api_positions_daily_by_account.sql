-- Function: api_positions_daily_by_account(uuid, uuid, date, date)
-- Description: Returns the daily positions for a given account and asset in a given date range.

CREATE FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) RETURNS TABLE(date date, units numeric, value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT date, units, value
FROM daily_positions_acct
WHERE user_id = app_current_user()
AND account_id = p_account
AND asset_id = p_asset
AND date BETWEEN p_from AND p_to
ORDER BY date;
$$;

ALTER FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) TO supabase_admin;

CREATE OR REPLACE FUNCTION public.api_holdings_accounts(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(account_id uuid, asset_id text, symbol text, units numeric, value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout = '3s'
AS $$
DECLARE
  current_user_id uuid := app_current_user();
  target_date date;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Step 1: Get latest date efficiently (same as simplified api_dashboard_holdings)
  SELECT date INTO target_date
  FROM public.daily_positions_acct
  WHERE user_id = current_user_id
    AND date <= p_date
    AND date >= p_date - 7  -- Only look within last 7 days from p_date
    AND is_final = true
  ORDER BY date DESC
  LIMIT 1;

  IF target_date IS NULL THEN
    RETURN;
  END IF;

  -- Step 2: Get holdings directly without JOINs (optimize later with enrichment in app)
  RETURN QUERY
  SELECT
    dp.account_id,
    dp.asset_id::text as asset_id,
    dp.asset_id::text as symbol,  -- Return raw asset_id, enrich in TypeScript
    SUM(dp.units)::numeric as units,
    SUM(dp.value)::numeric as value
  FROM public.daily_positions_acct dp
  WHERE dp.user_id = current_user_id
    AND dp.date = target_date
    AND dp.is_final = true
    AND dp.value > 0.01
  GROUP BY dp.account_id, dp.asset_id
  ORDER BY dp.account_id, SUM(dp.value) DESC;
END;
$$;

ALTER FUNCTION public.api_holdings_accounts(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO supabase_admin;


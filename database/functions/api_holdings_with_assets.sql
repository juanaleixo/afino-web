-- Function: api_holdings_with_assets(date)
-- Description: Enhanced version of api_holdings_at that includes asset metadata in one call

CREATE OR REPLACE FUNCTION public.api_holdings_with_assets(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  asset_id UUID,
  symbol TEXT,
  class TEXT,
  label_ptbr TEXT,
  units NUMERIC,
  value NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID := app_current_user();
  target_date DATE;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Find the latest available date <= p_date
  SELECT MAX(d.date) INTO target_date
  FROM public.daily_positions_acct d
  WHERE d.user_id = current_user_id
    AND d.date <= p_date
    AND COALESCE(d.is_final, true) = true;

  -- If no data found, return empty
  IF target_date IS NULL THEN
    RETURN;
  END IF;

  -- Return holdings with asset metadata
  RETURN QUERY
  SELECT
    dp.asset_id,
    ga.symbol,
    ga.class,
    ga.label_ptbr,
    SUM(dp.units)::numeric AS units,
    SUM(dp.value)::numeric AS value
  FROM public.daily_positions_acct dp
  JOIN public.global_assets ga ON ga.id = dp.asset_id
  WHERE dp.user_id = current_user_id
    AND dp.date = target_date
    AND COALESCE(dp.is_final, true) = true
  GROUP BY dp.asset_id, ga.symbol, ga.class, ga.label_ptbr
  HAVING SUM(dp.value) > 0.01
  ORDER BY SUM(dp.value) DESC;
END;
$$;

ALTER FUNCTION public.api_holdings_with_assets(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_holdings_with_assets(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_holdings_with_assets(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_holdings_with_assets(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_holdings_with_assets(p_date date) TO supabase_admin;
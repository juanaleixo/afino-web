CREATE OR REPLACE FUNCTION public.api_holdings_accounts(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(account_id uuid, asset_id text, symbol text, units numeric, value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := app_current_user();
  target_date date;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Usa a última data disponível menor ou igual a p_date
  SELECT MAX(d.date) INTO target_date
  FROM public.daily_positions_acct d
  WHERE d.user_id = current_user_id
    AND d.date <= p_date
    AND COALESCE(d.is_final, true) = true;

  IF target_date IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    dp.account_id,
    dp.asset_id::text as asset_id,
    COALESCE(ga.symbol, ca.symbol, dp.asset_id::text) as symbol,
    SUM(dp.units)::numeric as units,
    SUM(dp.value)::numeric as value
  FROM public.daily_positions_acct dp
  LEFT JOIN public.global_assets ga ON ga.symbol = dp.asset_id::text
  LEFT JOIN public.custom_assets ca ON ca.id::text = dp.asset_id::text AND ca.user_id = current_user_id
  WHERE dp.user_id = current_user_id
    AND dp.date = target_date
    AND COALESCE(dp.is_final, true) = true
  GROUP BY dp.account_id, dp.asset_id, ga.symbol, ca.symbol
  HAVING SUM(dp.value) > 0.01
  ORDER BY dp.account_id, COALESCE(ga.symbol, ca.symbol, dp.asset_id::text);
END;
$$;

ALTER FUNCTION public.api_holdings_accounts(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO supabase_admin;

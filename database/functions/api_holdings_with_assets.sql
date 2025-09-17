-- Function: api_holdings_with_assets(date)
-- Description: Lightweight version that returns holdings as tabular data
-- Optimized for frontend processing without heavy json_agg

CREATE OR REPLACE FUNCTION public.api_holdings_with_assets(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  asset_id TEXT,
  symbol TEXT,
  class TEXT,
  label_ptbr TEXT,
  units NUMERIC,
  value NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '3s'
AS $$
  WITH target_date_cte AS (
    SELECT d.date as target_date
    FROM daily_positions_acct d
    WHERE d.user_id = app_current_user()
      AND d.date <= p_date
      AND COALESCE(d.is_final, true) = true
    ORDER BY d.date DESC
    LIMIT 1
  )
  SELECT
    COALESCE(ga.symbol, ca.symbol, dp.asset_id::text) as asset_id,
    COALESCE(ga.symbol, ca.symbol, dp.asset_id::text) as symbol,
    COALESCE(ga.class, ca.class, 'unknown'::text) as class,
    COALESCE(ga.label_ptbr, ca.label, dp.asset_id::text) as label_ptbr,
    SUM(dp.units)::numeric as units,
    SUM(dp.value)::numeric as value
  FROM daily_positions_acct dp
  CROSS JOIN target_date_cte tdc
  LEFT JOIN global_assets ga ON ga.symbol = dp.asset_id::text
  LEFT JOIN custom_assets ca ON ca.id::text = dp.asset_id::text AND ca.user_id = app_current_user()
  WHERE dp.user_id = app_current_user()
    AND dp.date = tdc.target_date
    AND COALESCE(dp.is_final, true) = true
    AND dp.value > 0.01
  GROUP BY dp.asset_id, ga.symbol, ga.class, ga.label_ptbr, ca.symbol, ca.class, ca.label
  ORDER BY SUM(dp.value) DESC
  LIMIT 100;
$$;

ALTER FUNCTION public.api_holdings_with_assets(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_holdings_with_assets(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_holdings_with_assets(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_holdings_with_assets(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_holdings_with_assets(p_date date) TO supabase_admin;
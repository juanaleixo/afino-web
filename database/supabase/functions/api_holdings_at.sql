-- Function: api_holdings_at(date)
-- Description: Returns the holdings for a given date.

CREATE OR REPLACE FUNCTION public.api_holdings_at(p_date date)
RETURNS TABLE(asset_id uuid, units numeric, value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH target AS (
  SELECT MAX(d.date) AS d
  FROM public.daily_positions_acct d
  WHERE d.user_id = app_current_user()
    AND d.date <= p_date
)
SELECT
  dp.asset_id,
  SUM(dp.units)::numeric AS units,
  SUM(dp.value)::numeric AS value
FROM public.daily_positions_acct dp
CROSS JOIN target t
WHERE dp.user_id = app_current_user()
  AND dp.date = t.d
  AND COALESCE(dp.is_final, true) = true
GROUP BY dp.asset_id
ORDER BY dp.asset_id;
$$;

ALTER FUNCTION public.api_holdings_at(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO supabase_admin;

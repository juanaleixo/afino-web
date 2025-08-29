-- Function: api_holdings_detailed_at(date)
-- Description: Returns the detailed holdings with asset information for a given date.

CREATE OR REPLACE FUNCTION public.api_holdings_detailed_at(p_date date) 
RETURNS TABLE(
    asset_id uuid, 
    units numeric, 
    value numeric,
    symbol text,
    class text,
    label_ptbr text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT
        dp.asset_id,
        SUM(dp.units)::numeric AS units,
        SUM(dp.value)::numeric AS value,
        COALESCE(ga.symbol, dp.asset_id::text) as symbol,
        COALESCE(ga.class, 'unknown') as class,
        ga.label_ptbr
    FROM public.daily_positions_acct dp
    LEFT JOIN public.global_assets ga ON ga.id = dp.asset_id
    WHERE dp.user_id = app_current_user()
      AND dp.date = p_date
    GROUP BY dp.asset_id, ga.symbol, ga.class, ga.label_ptbr
    HAVING SUM(dp.value) > 0.000001  -- Filtrar posições zeradas
    ORDER BY ga.symbol NULLS LAST, dp.asset_id;
$$;

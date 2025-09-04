-- Function: api_portfolio_daily_detailed(date, date)
-- Description: Returns the daily portfolio value breakdown by asset for a given date range (Premium feature).

CREATE OR REPLACE FUNCTION public.api_portfolio_daily_detailed(p_from date, p_to date) 
RETURNS TABLE(
    date date, 
    asset_id text, 
    asset_value numeric,
    asset_symbol text,
    asset_class text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT 
        pvdd.date,
        COALESCE(ga.symbol, pvdd.asset_id::text) as asset_id, -- Retornar símbolo como asset_id
        pvdd.asset_value,
        COALESCE(ga.symbol, pvdd.asset_id::text) as asset_symbol,
        COALESCE(ga.class, 'unknown') as asset_class
    FROM public.portfolio_value_daily_detailed pvdd
    LEFT JOIN public.global_assets ga ON ga.symbol = pvdd.asset_id::text
    WHERE pvdd.user_id = app_current_user()
      AND pvdd.date BETWEEN p_from AND p_to
      AND pvdd.asset_value > 0.000001  -- Filtrar valores muito pequenos
    ORDER BY pvdd.date, ga.symbol NULLS LAST;
$$;
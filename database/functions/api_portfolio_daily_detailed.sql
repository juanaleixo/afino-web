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
SET statement_timeout = '5s'
AS $$
    SELECT 
        pvdd.date,
        COALESCE(ga.symbol, ca.symbol, pvdd.asset_id::text) as asset_id,
        pvdd.asset_value,
        COALESCE(ga.symbol, ca.symbol, pvdd.asset_id::text) as asset_symbol,
        COALESCE(ga.class, ca.class, 'unknown') as asset_class
    FROM public.portfolio_value_daily_detailed pvdd
    LEFT JOIN public.global_assets ga ON ga.symbol = pvdd.asset_id::text
    LEFT JOIN public.custom_assets ca ON ca.id::text = pvdd.asset_id::text AND ca.user_id = app_current_user()
    WHERE pvdd.user_id = app_current_user()
      AND pvdd.date BETWEEN p_from AND p_to
      AND pvdd.asset_value > 0.01  -- Filtrar valores muito pequenos
    ORDER BY pvdd.date, COALESCE(ga.symbol, ca.symbol, pvdd.asset_id);
$$;

ALTER FUNCTION public.api_portfolio_daily_detailed(p_from date, p_to date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_portfolio_daily_detailed(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_portfolio_daily_detailed(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_portfolio_daily_detailed(p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_portfolio_daily_detailed(p_from date, p_to date) TO supabase_admin;
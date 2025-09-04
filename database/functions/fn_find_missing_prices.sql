-- Function: fn_find_missing_prices()
-- Description: Identifies global assets that need price history population

CREATE OR REPLACE FUNCTION public.fn_find_missing_prices() 
RETURNS TABLE(
  asset_symbol text,
  asset_class text,
  currency text,
  last_price_date date,
  days_missing integer
)
LANGUAGE sql
AS $$
WITH assets_in_use AS (
  -- Encontra assets que têm events mas podem ter preços faltantes
  SELECT DISTINCT e.asset_symbol
  FROM public.events e
  WHERE e.asset_symbol IS NOT NULL
    AND e.asset_symbol !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' -- não é UUID
),
assets_with_price_info AS (
  SELECT 
    ga.symbol,
    ga.class,
    ga.currency,
    MAX(gpd.date) AS last_price_date,
    CURRENT_DATE - COALESCE(MAX(gpd.date), DATE '1900-01-01') AS days_missing
  FROM public.global_assets ga
  LEFT JOIN public.global_price_daily gpd ON gpd.asset_symbol = ga.symbol
  WHERE ga.symbol IN (SELECT asset_symbol FROM assets_in_use)
    AND ga.class IN ('stock', 'crypto') -- apenas classes que podem ter preços automáticos
  GROUP BY ga.symbol, ga.class, ga.currency
)
SELECT 
  symbol,
  class,
  currency,
  last_price_date,
  days_missing
FROM assets_with_price_info
WHERE days_missing > 1 -- mais de 1 dia sem preço
ORDER BY days_missing DESC, symbol;
$$;

ALTER FUNCTION public.fn_find_missing_prices() OWNER TO postgres;
GRANT ALL ON FUNCTION public.fn_find_missing_prices() TO authenticated;
GRANT ALL ON FUNCTION public.fn_find_missing_prices() TO service_role;
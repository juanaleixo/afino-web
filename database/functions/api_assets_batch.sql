-- Function: api_assets_batch(asset_ids[])
-- Description: Batch lookup for asset metadata to reduce individual queries

CREATE OR REPLACE FUNCTION public.api_assets_batch(p_asset_symbols TEXT[])
RETURNS TABLE (
  symbol TEXT,
  class TEXT,
  label_ptbr TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ga.symbol, ga.class, ga.label_ptbr
  FROM public.global_assets ga
  WHERE ga.symbol = ANY(p_asset_symbols)
  ORDER BY ga.symbol;
$$;

ALTER FUNCTION public.api_assets_batch(p_asset_symbols TEXT[]) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_assets_batch(p_asset_symbols TEXT[]) TO anon;
GRANT ALL ON FUNCTION public.api_assets_batch(p_asset_symbols TEXT[]) TO authenticated;
GRANT ALL ON FUNCTION public.api_assets_batch(p_asset_symbols TEXT[]) TO service_role;
GRANT ALL ON FUNCTION public.api_assets_batch(p_asset_symbols TEXT[]) TO supabase_admin;
-- Function: api_assets_batch(asset_ids[])
-- Description: Batch lookup for asset metadata to reduce individual queries

CREATE OR REPLACE FUNCTION public.api_assets_batch(p_asset_ids UUID[])
RETURNS TABLE (
  id UUID,
  symbol TEXT,
  class TEXT,
  label_ptbr TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ga.id, ga.symbol, ga.class, ga.label_ptbr
  FROM public.global_assets ga
  WHERE ga.id = ANY(p_asset_ids)
  ORDER BY ga.symbol;
$$;

ALTER FUNCTION public.api_assets_batch(p_asset_ids UUID[]) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_assets_batch(p_asset_ids UUID[]) TO anon;
GRANT ALL ON FUNCTION public.api_assets_batch(p_asset_ids UUID[]) TO authenticated;
GRANT ALL ON FUNCTION public.api_assets_batch(p_asset_ids UUID[]) TO service_role;
GRANT ALL ON FUNCTION public.api_assets_batch(p_asset_ids UUID[]) TO supabase_admin;
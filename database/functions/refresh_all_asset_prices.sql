-- Function: refresh_all_asset_prices()
-- Description: Refreshes latest prices for all assets in global_assets

CREATE OR REPLACE FUNCTION public.refresh_all_asset_prices() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id, symbol, class, currency FROM public.global_assets LOOP
    BEGIN
      IF r.class = 'crypto' THEN
        PERFORM public.fetch_price_crypto_history(r.symbol, 'crypto', r.currency);
      ELSIF r.class = 'stock' THEN
        PERFORM public.fetch_price_stock_history(r.symbol, r.currency);
      ELSE
        -- cash/currency: manter manual_price=1 ou preço via regra externa
        CONTINUE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao atualizar % (%): %', r.symbol, r.class, SQLERRM;
      CONTINUE;
    END;
  END LOOP;
END;
$$;

ALTER FUNCTION public.refresh_all_asset_prices() OWNER TO postgres;
GRANT ALL ON FUNCTION public.refresh_all_asset_prices() TO anon;
GRANT ALL ON FUNCTION public.refresh_all_asset_prices() TO authenticated;
GRANT ALL ON FUNCTION public.refresh_all_asset_prices() TO service_role;
GRANT ALL ON FUNCTION public.refresh_all_asset_prices() TO supabase_admin;


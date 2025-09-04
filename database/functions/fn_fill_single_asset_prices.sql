-- Function: fn_fill_single_asset_prices()
-- Description: Preenche preços para um único asset (chamada rápida após evento)

CREATE OR REPLACE FUNCTION public.fn_fill_single_asset_prices(
  p_asset_symbol text
) 
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_asset RECORD;
  v_result jsonb;
BEGIN
  -- Busca informações do asset
  SELECT ga.symbol, ga.class, ga.currency
  INTO v_asset
  FROM public.global_assets ga
  WHERE ga.symbol = p_asset_symbol
    AND ga.class IN ('stock', 'crypto'); -- apenas classes com preços automáticos

  IF v_asset IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Asset not found or not supported for automatic pricing'
    );
  END IF;

  BEGIN
    -- Chama função de fetch baseada na classe
    IF v_asset.class = 'stock' THEN
      PERFORM public.fetch_price_stock_history(v_asset.symbol, v_asset.currency);
    ELSIF v_asset.class = 'crypto' THEN
      PERFORM public.fetch_price_crypto_history(v_asset.symbol, 'crypto', v_asset.currency);
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'asset_symbol', v_asset.symbol,
      'asset_class', v_asset.class,
      'message', 'Prices fetched successfully'
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'asset_symbol', v_asset.symbol,
      'error', SQLERRM
    );
  END;
END;
$$;

ALTER FUNCTION public.fn_fill_single_asset_prices(text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.fn_fill_single_asset_prices(text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_fill_single_asset_prices(text) TO service_role;
  -- Function: fn_populate_missing_prices_batch()
  -- Description: Populates missing prices for assets in controlled batches (background safe)

  CREATE OR REPLACE FUNCTION public.fn_populate_missing_prices_batch(
    p_batch_size integer DEFAULT 3,
    p_max_runtime_seconds integer DEFAULT 60
  ) 
  RETURNS jsonb
  LANGUAGE plpgsql
  AS $$
  DECLARE
    v_asset RECORD;
    v_start_time timestamp := clock_timestamp();
    v_processed integer := 0;
    v_success integer := 0;
    v_errors jsonb := '[]'::jsonb;
    v_result jsonb;
  BEGIN
    -- Busca assets com preços faltantes (limitado por batch)
    FOR v_asset IN 
      SELECT asset_symbol, asset_class, currency, days_missing
      FROM public.fn_find_missing_prices()
      LIMIT p_batch_size
    LOOP
      -- Verifica timeout
      IF EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) > p_max_runtime_seconds THEN
        EXIT; -- Para por timeout
      END IF;

      v_processed := v_processed + 1;

      BEGIN
        -- Chama função específica baseada na classe do asset
        IF v_asset.asset_class = 'stock' THEN
          PERFORM public.fetch_price_stock_history(v_asset.asset_symbol, v_asset.currency);
        ELSIF v_asset.asset_class = 'crypto' THEN
          PERFORM public.fetch_price_crypto_history(v_asset.asset_symbol, 'crypto', v_asset.currency);
        END IF;
        
        v_success := v_success + 1;
        
        -- Log sucesso
        RAISE NOTICE 'Preços populados para %: % dias faltantes', v_asset.asset_symbol, v_asset.days_missing;
        
      EXCEPTION WHEN OTHERS THEN
        -- Captura erros sem parar o processo
        v_errors := v_errors || jsonb_build_object(
          'asset', v_asset.asset_symbol,
          'error', SQLERRM
        );
        RAISE NOTICE 'Erro ao popular preços para %: %', v_asset.asset_symbol, SQLERRM;
      END;

      -- Pequena pausa entre requests (rate limiting)
      PERFORM pg_sleep(0.5);
    END LOOP;

    -- Resultado do processamento
    v_result := jsonb_build_object(
      'processed', v_processed,
      'success', v_success,
      'errors', jsonb_array_length(v_errors),
      'error_details', v_errors,
      'runtime_seconds', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time))::integer
    );

    RETURN v_result;
  END;
  $$;

  ALTER FUNCTION public.fn_populate_missing_prices_batch(integer, integer) OWNER TO postgres;
  GRANT ALL ON FUNCTION public.fn_populate_missing_prices_batch(integer, integer) TO authenticated;
  GRANT ALL ON FUNCTION public.fn_populate_missing_prices_batch(integer, integer) TO service_role;
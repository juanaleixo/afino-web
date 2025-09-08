-- Function: fetch_price_crypto_history_v2 (versão melhorada)
-- Description: Versão robusta com múltiplas APIs e fallbacks

CREATE OR REPLACE FUNCTION public.fetch_price_crypto_history_v2(
  v_symbol text, 
  v_class text DEFAULT 'crypto'::text, 
  v_currency text DEFAULT 'BRL'::text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  response jsonb;
  data jsonb;
  item jsonb;
  date_value date;
  close_value numeric;
  v_asset_symbol text;
  usdt_response jsonb;
  usd_brl_rate numeric;
  api_status text;
  records_inserted integer := 0;
  result jsonb;
  error_msg text;
BEGIN
  -- Garantir que o ativo existe em global_assets
  SELECT symbol INTO v_asset_symbol FROM global_assets
  WHERE lower(symbol) = lower(v_symbol) AND class = v_class AND currency = v_currency;
  
  IF v_asset_symbol IS NULL THEN
    INSERT INTO global_assets (symbol, class, currency)
    VALUES (v_symbol, v_class, v_currency);
    v_asset_symbol := v_symbol;
  END IF;

  -- Estratégia 1: Tentar par direto (ex: BTC/BRL)
  BEGIN
    RAISE NOTICE '[%] Tentando par direto %/%...', v_symbol, v_symbol, v_currency;
    
    SELECT content::jsonb INTO response
    FROM http_get(format(
      'https://min-api.cryptocompare.com/data/v2/histoday?fsym=%s&tsym=%s&limit=365',
      v_symbol, v_currency
    ));

    api_status := response->>'Response';
    
    IF api_status = 'Success' AND response->'Data'->'Data' IS NOT NULL THEN
      data := response->'Data'->'Data';
      
      IF jsonb_array_length(data) > 0 THEN
        -- Processar dados do par direto
        FOR item IN SELECT * FROM jsonb_array_elements(data)
        LOOP
          date_value := to_timestamp((item->>'time')::bigint)::date;
          close_value := (item->>'close')::numeric;
          
          IF close_value IS NOT NULL AND close_value > 0 THEN
            INSERT INTO global_price_daily (asset_symbol, date, price)
            VALUES (v_asset_symbol, date_value, close_value)
            ON CONFLICT (asset_symbol, date) DO UPDATE SET price = EXCLUDED.price;
            records_inserted := records_inserted + 1;
          END IF;
        END LOOP;
        
        RAISE NOTICE '[%] Par direto: % registros inseridos', v_symbol, records_inserted;
        
        RETURN jsonb_build_object(
          'success', true,
          'method', 'direct_pair',
          'pair', v_symbol || '/' || v_currency,
          'records', records_inserted
        );
      END IF;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    error_msg := SQLERRM;
    RAISE NOTICE '[%] Erro par direto: %', v_symbol, error_msg;
  END;

  -- Estratégia 2: Ponte via USDT (apenas para BRL)
  IF v_currency = 'BRL' THEN
    BEGIN
      RAISE NOTICE '[%] Tentando ponte via USDT...', v_symbol;
      
      -- Buscar crypto/USDT
      SELECT content::jsonb INTO usdt_response
      FROM http_get(format(
        'https://min-api.cryptocompare.com/data/v2/histoday?fsym=%s&tsym=USDT&limit=365',
        v_symbol
      ));

      -- Buscar taxa USD/BRL atual
      SELECT content::jsonb INTO response
      FROM http_get('https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=BRL');
      
      usd_brl_rate := (response->>'BRL')::numeric;
      
      IF usdt_response->>'Response' = 'Success' 
         AND usdt_response->'Data'->'Data' IS NOT NULL 
         AND usd_brl_rate > 0 THEN
        
        data := usdt_response->'Data'->'Data';
        
        IF jsonb_array_length(data) > 0 THEN
          RAISE NOTICE '[%] Ponte USDT: taxa USD/BRL = %', v_symbol, usd_brl_rate;
          
          FOR item IN SELECT * FROM jsonb_array_elements(data)
          LOOP
            date_value := to_timestamp((item->>'time')::bigint)::date;
            close_value := (item->>'close')::numeric * usd_brl_rate;
            
            IF close_value IS NOT NULL AND close_value > 0 THEN
              INSERT INTO global_price_daily (asset_symbol, date, price)
              VALUES (v_asset_symbol, date_value, close_value)
              ON CONFLICT (asset_symbol, date) DO UPDATE SET price = EXCLUDED.price;
              records_inserted := records_inserted + 1;
            END IF;
          END LOOP;
          
          RAISE NOTICE '[%] Ponte USDT: % registros inseridos', v_symbol, records_inserted;
          
          RETURN jsonb_build_object(
            'success', true,
            'method', 'usdt_bridge',
            'pair', v_symbol || '/USDT -> BRL',
            'usd_brl_rate', usd_brl_rate,
            'records', records_inserted
          );
        END IF;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_msg := SQLERRM;
      RAISE NOTICE '[%] Erro ponte USDT: %', v_symbol, error_msg;
    END;
  END IF;

  -- Estratégia 3: API alternativa (CoinGecko) como último recurso
  IF v_currency = 'BRL' AND records_inserted = 0 THEN
    BEGIN
      RAISE NOTICE '[%] Tentando CoinGecko como fallback...', v_symbol;
      
      -- CoinGecko API (free tier, mais limitada)
      SELECT content::jsonb INTO response
      FROM http_get(format(
        'https://api.coingecko.com/api/v3/coins/%s/market_chart?vs_currency=brl&days=90',
        lower(v_symbol)
      ));

      IF response->'prices' IS NOT NULL THEN
        -- CoinGecko retorna array de [timestamp_ms, price]
        FOR item IN SELECT * FROM jsonb_array_elements(response->'prices')
        LOOP
          date_value := to_timestamp((item->>0)::bigint / 1000)::date;
          close_value := (item->>1)::numeric;
          
          IF close_value IS NOT NULL AND close_value > 0 THEN
            INSERT INTO global_price_daily (asset_symbol, date, price)
            VALUES (v_asset_symbol, date_value, close_value)
            ON CONFLICT (asset_symbol, date) DO UPDATE SET price = EXCLUDED.price;
            records_inserted := records_inserted + 1;
          END IF;
        END LOOP;
        
        RAISE NOTICE '[%] CoinGecko: % registros inseridos', v_symbol, records_inserted;
        
        RETURN jsonb_build_object(
          'success', true,
          'method', 'coingecko_fallback',
          'pair', v_symbol || '/BRL',
          'records', records_inserted
        );
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_msg := SQLERRM;
      RAISE NOTICE '[%] Erro CoinGecko: %', v_symbol, error_msg;
    END;
  END IF;

  -- Se chegou até aqui, não conseguiu nenhum preço
  RAISE NOTICE '[%] FALHA: Nenhum preço obtido por nenhum método', v_symbol;
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Nenhum método de busca de preço funcionou',
    'symbol', v_symbol,
    'currency', v_currency
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[%] ERRO GERAL: %', v_symbol, SQLERRM;
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'symbol', v_symbol,
    'currency', v_currency
  );
END;
$$;
-- Function: fetch_price_crypto_history(text, text, text)
-- Description: Fetches the historical price data for a given crypto currency.

CREATE OR REPLACE FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text DEFAULT 'crypto'::text, v_currency text DEFAULT 'BRL'::text) RETURNS void
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
  usdt_data jsonb;
  usdt_item jsonb;
  usd_brl_rate numeric;
  use_usdt_bridge boolean := false;
  api_status text;
  records_inserted integer := 0;
BEGIN
  -- Garantir que o ativo existe em global_assets (cria se não existir)
  SELECT symbol INTO v_asset_symbol FROM global_assets
  WHERE lower(symbol) = lower(v_symbol) AND class = v_class AND currency = v_currency;
  
  IF v_asset_symbol IS NULL THEN
    -- Insere normalizado (gatilho garante UPPER e label)
    INSERT INTO global_assets (symbol, class, currency)
    VALUES (v_symbol, v_class, v_currency);
    v_asset_symbol := v_symbol;
  END IF;

  RAISE NOTICE 'Buscando preços de % em % via CryptoCompare...', v_symbol, v_currency;

  -- Tentar primeiro o par direto com a moeda desejada (BRL)
  BEGIN
    SELECT content::jsonb INTO response
    FROM http_get(format(
      'https://min-api.cryptocompare.com/data/v2/histoday?fsym=%s&tsym=%s&limit=365',
      v_symbol, v_currency
    ));

    -- Verificar se a resposta é válida
    api_status := response->>'Response';
    
    IF api_status = 'Success' AND response->'Data'->'Data' IS NOT NULL THEN
      data := response->'Data'->'Data';
      
      -- Verificar se há dados válidos
      IF jsonb_array_length(data) > 0 THEN
        RAISE NOTICE 'Par direto %/% encontrado com % registros', v_symbol, v_currency, jsonb_array_length(data);
      ELSE
        RAISE NOTICE 'Par direto %/% existe mas sem dados históricos', v_symbol, v_currency;
        use_usdt_bridge := true;
      END IF;
    ELSE
      RAISE NOTICE 'Par direto %/% não disponível: %', v_symbol, v_currency, COALESCE(response->>'Message', 'API error');
      use_usdt_bridge := true;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao buscar par direto %/%: %', v_symbol, v_currency, SQLERRM;
    use_usdt_bridge := true;
  END;

  -- Se não conseguiu o par direto e é BRL, tentar ponte via USDT
  IF use_usdt_bridge AND v_currency = 'BRL' THEN
    RAISE NOTICE 'Tentando ponte via USDT para %...', v_symbol;
    
    BEGIN
      -- Buscar preços crypto/USDT
      SELECT content::jsonb INTO usdt_response
      FROM http_get(format(
        'https://min-api.cryptocompare.com/data/v2/histoday?fsym=%s&tsym=USDT&limit=365',
        v_symbol
      ));

      -- Buscar taxa USD/BRL atual (aproximada)
      SELECT content::jsonb INTO response
      FROM http_get('https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=BRL');
      
      usd_brl_rate := (response->>'BRL')::numeric;
      
      IF usdt_response->>'Response' = 'Success' AND usdt_response->'Data'->'Data' IS NOT NULL AND usd_brl_rate > 0 THEN
        usdt_data := usdt_response->'Data'->'Data';
        
        IF jsonb_array_length(usdt_data) > 0 THEN
          RAISE NOTICE 'Usando ponte USDT com taxa USD/BRL: %', usd_brl_rate;
          
          -- Converter preços USDT para BRL
          FOR usdt_item IN SELECT * FROM jsonb_array_elements(usdt_data)
          LOOP
            date_value := to_timestamp((usdt_item->>'time')::bigint)::date;
            close_value := (usdt_item->>'close')::numeric * usd_brl_rate;
            
            -- Só inserir se o preço for válido
            IF close_value IS NOT NULL AND close_value > 0 THEN
              INSERT INTO global_price_daily (asset_symbol, date, price)
              VALUES (v_asset_symbol, date_value, close_value)
              ON CONFLICT (asset_symbol, date) DO UPDATE SET price = EXCLUDED.price;
              
              records_inserted := records_inserted + 1;
            END IF;
          END LOOP;
          
          RAISE NOTICE 'Inseridos % registros via ponte USDT para %', records_inserted, v_symbol;
          RETURN; -- Sucesso via ponte
        END IF;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro ao usar ponte USDT: %', SQLERRM;
    END;
  END IF;

  -- Processar dados do par direto (se disponível)
  IF NOT use_usdt_bridge AND data IS NOT NULL THEN
    FOR item IN SELECT * FROM jsonb_array_elements(data)
    LOOP
      date_value := to_timestamp((item->>'time')::bigint)::date;
      close_value := (item->>'close')::numeric;
      
      -- Só inserir se o preço for válido
      IF close_value IS NOT NULL AND close_value > 0 THEN
        INSERT INTO global_price_daily (asset_symbol, date, price)
        VALUES (v_asset_symbol, date_value, close_value)
        ON CONFLICT (asset_symbol, date) DO UPDATE SET price = EXCLUDED.price;
        
        records_inserted := records_inserted + 1;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Inseridos % registros diretos para %', records_inserted, v_symbol;
  END IF;

  -- Se não conseguiu nenhum dado
  IF records_inserted = 0 THEN
    RAISE NOTICE 'Nenhum preço obtido para % em %', v_symbol, v_currency;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro geral ao buscar preços de %: %', v_symbol, SQLERRM;
END;
$$;

ALTER FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) OWNER TO postgres;

GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO anon;
GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO authenticated;
GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO service_role;
GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO supabase_admin;

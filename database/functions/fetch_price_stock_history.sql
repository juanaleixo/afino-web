-- Function: fetch_price_stock_history(symbol text, currency text)
-- Description: Fetches historical daily closes for a stock using Yahoo Finance.

CREATE OR REPLACE FUNCTION public.fetch_price_stock_history(v_symbol text, v_currency text DEFAULT 'BRL'::text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  response jsonb;
  chart jsonb;
  timestamps jsonb;
  closes jsonb;
  i int;
  ts bigint;
  close_val numeric;
  v_asset_symbol text;
  v_symbol_yh text;
  v_from bigint := extract(epoch FROM (CURRENT_DATE - INTERVAL '365 days'))::bigint;
  v_to bigint := extract(epoch FROM (CURRENT_DATE + INTERVAL '1 day'))::bigint;
BEGIN
  -- Normalizar/assegurar ativo existe
  SELECT symbol INTO v_asset_symbol FROM public.global_assets
  WHERE lower(symbol) = lower(v_symbol) AND class = 'stock' AND currency = v_currency;
  IF v_asset_symbol IS NULL THEN
    INSERT INTO public.global_assets(id, symbol, class, currency)
    VALUES (gen_random_uuid(), v_symbol, 'stock', v_currency);
    v_asset_symbol := v_symbol;
  END IF;

  -- Ajuste de sufixo para Yahoo (BRL -> .SA)
  v_symbol_yh := upper(v_symbol);
  IF v_currency = 'BRL' THEN
    v_symbol_yh := v_symbol_yh || '.SA';
  END IF;

  -- Consulta Yahoo Finance chart API
  SELECT content::jsonb -> 'chart' -> 'result' -> 0 INTO chart
  FROM http_get(format(
    'https://query1.finance.yahoo.com/v8/finance/chart/%s?period1=%s&period2=%s&interval=1d',
    v_symbol_yh, v_from::text, v_to::text
  ));

  IF chart IS NULL THEN
    RAISE NOTICE 'Yahoo chart API returned NULL for %', v_symbol_yh;
    RETURN;
  END IF;

  timestamps := chart -> 'timestamp';
  closes := chart -> 'indicators' -> 'quote' -> 0 -> 'close';

  IF jsonb_typeof(timestamps) <> 'array' OR jsonb_typeof(closes) <> 'array' THEN
    RAISE NOTICE 'Yahoo data arrays missing for %', v_symbol_yh;
    RETURN;
  END IF;

  FOR i IN 0..(jsonb_array_length(timestamps) - 1) LOOP
    ts := (timestamps -> i)::text::bigint;
    close_val := NULLIF((closes -> i)::text, 'null')::numeric;
    IF close_val IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.global_price_daily(asset_symbol, date, price)
    VALUES (v_asset_symbol, to_timestamp(ts)::date, close_val)
    ON CONFLICT (asset_symbol, date) DO UPDATE SET price = EXCLUDED.price;
  END LOOP;
END;
$$;

ALTER FUNCTION public.fetch_price_stock_history(v_symbol text, v_currency text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.fetch_price_stock_history(v_symbol text, v_currency text) TO anon;
GRANT ALL ON FUNCTION public.fetch_price_stock_history(v_symbol text, v_currency text) TO authenticated;
GRANT ALL ON FUNCTION public.fetch_price_stock_history(v_symbol text, v_currency text) TO service_role;
GRANT ALL ON FUNCTION public.fetch_price_stock_history(v_symbol text, v_currency text) TO supabase_admin;


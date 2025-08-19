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
v_asset_id uuid;
BEGIN
-- Garantir que o ativo existe em global_assets (cria se não existir)
SELECT id INTO v_asset_id FROM global_assets
WHERE lower(symbol) = lower(v_symbol) AND class = v_class AND currency = v_currency;
IF v_asset_id IS NULL THEN
-- Insere normalizado (gatilho garante UPPER e label)
INSERT INTO global_assets (id, symbol, class, currency)
VALUES (gen_random_uuid(), v_symbol, v_class, v_currency)
RETURNING id INTO v_asset_id;
END IF;
-- Buscar histórico (CryptoCompare)
SELECT content::jsonb INTO response
FROM http_get(format(
'https://min-api.cryptocompare.com/data/v2/histoday?fsym=%s&tsym=%s&limit=2000',
v_symbol, v_currency
));
-- Extrair o array "Data"
data := response->'Data'->'Data';
-- Loop em cada item do array e inserir/atualizar
FOR item IN SELECT * FROM jsonb_array_elements(data)
LOOP
date_value := to_timestamp((item->>'time')::bigint)::date;
close_value := (item->>'close')::numeric;
INSERT INTO global_price_daily (asset_id, date, price)
VALUES (v_asset_id, date_value, close_value)
ON CONFLICT (asset_id, date) DO UPDATE SET price = EXCLUDED.price;
END LOOP;
END;
$$;

ALTER FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) OWNER TO postgres;

GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO anon;
GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO authenticated;
GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO service_role;
GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO supabase_admin;

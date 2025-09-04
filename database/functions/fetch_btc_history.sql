-- Function: fetch_btc_history()
-- Description: Fetches the historical data for BTC.

CREATE FUNCTION public.fetch_btc_history() RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
response jsonb;
data jsonb;
item jsonb;
date_value date;
close_value numeric;
BEGIN
-- Busca 2000 dias de histórico (ajuste conforme necessário)
SELECT content::jsonb INTO response
FROM http_get('https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=2000');
-- Extrai o array "Data"
data := response->'Data'->'Data';
-- Loop em cada item
FOR item IN SELECT * FROM jsonb_array_elements(data)
LOOP
date_value := to_timestamp((item->>'time')::bigint)::date;
close_value := (item->>'close')::numeric;
-- Insere ou atualiza
INSERT INTO global_price_daily (asset_symbol, date, price)
VALUES ('BTC', date_value, close_value)
ON CONFLICT (asset_symbol, date) DO UPDATE SET price = EXCLUDED.price;
END LOOP;
END;
$$;

ALTER FUNCTION public.fetch_btc_history() OWNER TO postgres;

GRANT ALL ON FUNCTION public.fetch_btc_history() TO anon;
GRANT ALL ON FUNCTION public.fetch_btc_history() TO authenticated;
GRANT ALL ON FUNCTION public.fetch_btc_history() TO service_role;
GRANT ALL ON FUNCTION public.fetch_btc_history() TO supabase_admin;

--
-- PostgreSQL database dump
--
-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.5
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--
CREATE SCHEMA public;
ALTER SCHEMA public OWNER TO pg_database_owner;
--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--
COMMENT ON SCHEMA public IS 'standard public schema';
--
-- Name: api_holdings_accounts(date); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.api_holdings_accounts(p_date date) RETURNS TABLE(account_id uuid, asset_id uuid, units numeric, value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT
dp.account_id,
dp.asset_id,
dp.units,
dp.value
FROM public.daily_positions_acct dp
WHERE dp.user_id = app_current_user()
AND dp.date = p_date
ORDER BY dp.account_id, dp.asset_id;
$$;
ALTER FUNCTION public.api_holdings_accounts(p_date date) OWNER TO postgres;
--
-- Name: api_holdings_at(date); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.api_holdings_at(p_date date) RETURNS TABLE(asset_id uuid, units numeric, value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT
dp.asset_id,
SUM(dp.units)::numeric AS units,
SUM(dp.value)::numeric AS value
FROM public.daily_positions_acct dp
WHERE dp.user_id = app_current_user()
AND dp.date = p_date
GROUP BY dp.asset_id
ORDER BY dp.asset_id;
$$;
ALTER FUNCTION public.api_holdings_at(p_date date) OWNER TO postgres;
--
-- Name: api_portfolio_daily(date, date); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.api_portfolio_daily(p_from date, p_to date) RETURNS TABLE(date date, total_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT d.date, d.total_value
FROM public.portfolio_value_daily d
WHERE d.user_id = app_current_user()
AND d.date BETWEEN p_from AND p_to
ORDER BY d.date;
$$;
ALTER FUNCTION public.api_portfolio_daily(p_from date, p_to date) OWNER TO postgres;
--
-- Name: api_portfolio_daily_accounts(date, date); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) RETURNS TABLE(date date, account_id uuid, total_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT date, account_id, total_value
FROM portfolio_value_daily_acct
WHERE user_id = app_current_user()
AND date BETWEEN p_from AND p_to
ORDER BY date, account_id;
$$;
ALTER FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) OWNER TO postgres;
--
-- Name: api_portfolio_monthly(date, date); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.api_portfolio_monthly(p_from date, p_to date) RETURNS TABLE(month_eom date, total_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT m.month_eom, m.total_value
FROM public.portfolio_value_monthly m
WHERE m.user_id = app_current_user()
AND m.month_eom BETWEEN p_from AND p_to
ORDER BY m.month_eom;
$$;
ALTER FUNCTION public.api_portfolio_monthly(p_from date, p_to date) OWNER TO postgres;
--
-- Name: api_positions_daily_by_account(uuid, uuid, date, date); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) RETURNS TABLE(date date, units numeric, value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT date, units, value
FROM daily_positions_acct
WHERE user_id = app_current_user()
AND account_id = p_account
AND asset_id = p_asset
AND date BETWEEN p_from AND p_to
ORDER BY date;
$$;
ALTER FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) OWNER TO postgres;
--
-- Name: api_positions_daily_by_asset(uuid, date, date); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) RETURNS TABLE(date date, units numeric, value numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT date, SUM(units)::numeric, SUM(value)::numeric
FROM daily_positions_acct
WHERE user_id = app_current_user()
AND asset_id = p_asset
AND date BETWEEN p_from AND p_to
GROUP BY date
ORDER BY date;
$$;
ALTER FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) OWNER TO postgres;
--
-- Name: app_current_user(); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.app_current_user() RETURNS uuid
LANGUAGE plpgsql STABLE
AS $$
DECLARE v uuid;
BEGIN
-- Supabase: tentar auth.uid()
BEGIN
EXECUTE 'SELECT auth.uid()' INTO v;
IF v IS NOT NULL THEN
RETURN v;
END IF;
EXCEPTION WHEN undefined_function THEN
-- ignore se não existir
END;
-- Fallback: variável de sessão app.user_id (defina no backend)
v := NULLIF(current_setting('app.user_id', true), '')::uuid;
RETURN v;
END$$;
ALTER FUNCTION public.app_current_user() OWNER TO postgres;
--
-- Name: change_user_password(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
-- Use service role to update auth.users
UPDATE auth.users
SET encrypted_password = crypt(new_plain_password, gen_salt('bf'))
WHERE id = target_user_id;
END;
$$;
ALTER FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) OWNER TO postgres;
--
-- Name: ensure_daily_positions_partitions(date, date); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
d_start date := date_trunc('month', p_from)::date;
d_end date := date_trunc('month', p_to)::date;
d_cur date;
part_name text;
part_exists boolean;
range_start date;
range_end date;
BEGIN
IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
RAISE EXCEPTION 'Parâmetros inválidos em ensure_daily_positions_partitions (p_from=%, p_to=%)', p_from, p_to;
END IF;
d_cur := d_start;
WHILE d_cur <= d_end LOOP
part_name := format('daily_positions_acct_%s', to_char(d_cur, 'YYYY_MM'));
range_start := d_cur;
range_end := (d_cur + INTERVAL '1 month')::date;
SELECT EXISTS (
SELECT 1
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relname = part_name
) INTO part_exists;
IF NOT part_exists THEN
-- cria a partição do mês
EXECUTE format(
'CREATE TABLE public.%I PARTITION OF public.daily_positions_acct FOR VALUES FROM (%L) TO (%L);',
part_name, range_start, range_end
);
-- índices essenciais na partição
EXECUTE format(
'CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, date);',
'ix_'||part_name||'_user_date', part_name
);
EXECUTE format(
'CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, asset_id, date);',
'ix_'||part_name||'_user_asset_date', part_name
);
EXECUTE format(
'CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, account_id, asset_id, date);',
'ix_'||part_name||'_user_acct_asset_date', part_name
);
END IF;
d_cur := range_end;
END LOOP;
END$$;
ALTER FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) OWNER TO postgres;
--
-- Name: fetch_btc_history(); Type: FUNCTION; Schema: public; Owner: postgres
--
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
INSERT INTO global_price_daily (asset_id, date, price)
VALUES ('asset_btc', date_value, close_value)
ON CONFLICT (asset_id, date) DO UPDATE SET price = EXCLUDED.price;
END LOOP;
END;
$$;
ALTER FUNCTION public.fetch_btc_history() OWNER TO postgres;
--
-- Name: fetch_price_crypto_history(text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text DEFAULT 'crypto'::text, v_currency text DEFAULT 'BRL'::text) RETURNS void
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
WHERE symbol = v_symbol AND class = v_class AND currency = v_currency;
IF v_asset_id IS NULL THEN
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
--
-- Name: fn_backfill_user(uuid, date); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.fn_backfill_user(p_user uuid, p_from date) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
r RECORD;
v_from date;
BEGIN
IF p_user IS NULL OR p_from IS NULL THEN
RAISE EXCEPTION 'fn_backfill_user: argumentos inválidos';
END IF;
-- Garante partições
PERFORM ensure_daily_positions_partitions(p_from, CURRENT_DATE + INTERVAL '1 month');
FOR r IN
SELECT e.account_id, e.asset_id, MIN((e.tstamp)::date) AS first_date
FROM public.events e
WHERE e.user_id = p_user
GROUP BY e.account_id, e.asset_id
LOOP
v_from := LEAST(COALESCE(r.first_date, p_from), p_from);
PERFORM fn_recalc_positions_acct(p_user, r.account_id, r.asset_id, v_from);
END LOOP;
END$$;
ALTER FUNCTION public.fn_backfill_user(p_user uuid, p_from date) OWNER TO postgres;
--
-- Name: fn_dpa_keep_zero_borders(uuid, uuid, uuid, date, date, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset uuid, p_from date, p_to date, p_eps numeric DEFAULT 0.000000001) RETURNS void
LANGUAGE sql
AS $$
WITH rng AS (
SELECT d.date,
COALESCE(d.value,0) AS value,
COALESCE(d.units,0) AS units
FROM public.daily_positions_acct d
WHERE d.user_id = p_user
AND d.account_id = p_account
AND d.asset_id = p_asset
AND d.date BETWEEN (p_from - INTERVAL '1 day')::date
AND (p_to + INTERVAL '1 day')::date
),
mark AS (
SELECT date, value, units,
LAG(value) OVER (ORDER BY date) AS prev_val,
LEAD(value) OVER (ORDER BY date) AS next_val
FROM rng
),
to_delete AS (
SELECT date
FROM mark
WHERE date BETWEEN p_from AND p_to
AND ABS(value) <= p_eps -- dia é zero
AND prev_val IS NOT NULL -- ambos vizinhos existem
AND next_val IS NOT NULL
AND ABS(prev_val) <= p_eps -- e ambos também zero
AND ABS(next_val) <= p_eps
)
DELETE FROM public.daily_positions_acct d
USING to_delete x
WHERE d.user_id = p_user
AND d.account_id = p_account
AND d.asset_id = p_asset
AND d.date = x.date;
$$;
ALTER FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset uuid, p_from date, p_to date, p_eps numeric) OWNER TO postgres;
--
-- Name: fn_recalc_positions_acct(uuid, uuid, uuid, date); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
v_from date;
v_to date := CURRENT_DATE;
v_curr text;
BEGIN
IF p_user IS NULL OR p_asset IS NULL OR p_account IS NULL OR p_from IS NULL THEN
RAISE EXCEPTION 'fn_recalc_positions_acct: argumentos inválidos';
END IF;
-- serialização por (user,account,asset)
PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_account::text||':'||p_asset::text, 0));
-- menor data afetada
SELECT LEAST(
COALESCE((SELECT min((e.tstamp)::date)
FROM public.events e
WHERE e.user_id=p_user AND e.account_id=p_account AND e.asset_id=p_asset), p_from),
p_from
)
INTO v_from;
IF v_from IS NULL THEN v_from := p_from; END IF;
-- garantir partições no range
PERFORM ensure_daily_positions_partitions(v_from, v_to);
-- info do ativo (apenas currency para gravar)
SELECT ga.currency INTO v_curr
FROM public.global_assets ga
WHERE ga.id = p_asset;
IF v_curr IS NULL THEN
RAISE EXCEPTION 'Ativo % não encontrado em global_assets', p_asset;
END IF;
-- limpa janela e reconstroi
DELETE FROM public.daily_positions_acct
WHERE user_id=p_user AND account_id=p_account AND asset_id=p_asset
AND date BETWEEN v_from AND v_to;
WITH cal AS (
SELECT d.date FROM public.dim_calendar d WHERE d.date BETWEEN v_from AND v_to
),
ev AS (
SELECT (e.tstamp)::date AS date, SUM(e.units_delta)::numeric(38,18) AS delta
FROM public.events e
WHERE e.user_id=p_user AND e.account_id=p_account AND e.asset_id=p_asset
GROUP BY 1
),
steps AS (
SELECT c.date, COALESCE(ev.delta,0)::numeric(38,18) AS daily_change
FROM cal c LEFT JOIN ev ON ev.date=c.date
),
cum AS (
SELECT s.date, SUM(s.daily_change) OVER (ORDER BY s.date) AS units
FROM steps s
),
price AS (
SELECT c.date,
(SELECT g.price
FROM public.global_price_daily g
WHERE g.asset_id=p_asset AND g.date<=c.date
ORDER BY g.date DESC
LIMIT 1)::numeric(20,10) AS price
FROM cal c
),
cav AS ( -- valuation custom por conta/ativo/dia
SELECT v.date, v.value::numeric(20,10) AS value
FROM public.custom_account_valuations v
WHERE v.account_id=p_account AND v.asset_id=p_asset
AND v.date BETWEEN v_from AND v_to
)
INSERT INTO public.daily_positions_acct
(user_id, account_id, asset_id, date, units, price, value, currency, source_price, is_final)
SELECT
p_user, p_account, p_asset, c.date,
COALESCE(cu.units,0)::numeric(38,18) AS units,
CASE WHEN cav.value IS NOT NULL THEN NULL ELSE pr.price END AS price,
CASE WHEN cav.value IS NOT NULL THEN cav.value
ELSE COALESCE(cu.units,0) * COALESCE(pr.price,0) END AS value,
v_curr AS currency,
CASE WHEN cav.value IS NOT NULL THEN 'custom'
WHEN pr.price IS NOT NULL THEN 'global' ELSE 'manual' END AS source_price,
true AS is_final
FROM cal c
LEFT JOIN cum cu ON cu.date=c.date
LEFT JOIN price pr ON pr.date=c.date
LEFT JOIN cav ON cav.date=c.date;
END$$;
ALTER FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) OWNER TO postgres;
--
-- Name: get_holdings_secure(); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.get_holdings_secure() RETURNS TABLE(user_id uuid, account_id uuid, asset_id uuid, units numeric)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
RETURN QUERY
SELECT h.user_id, h.account_id, h.asset_id, h.units
FROM holdings h
WHERE h.user_id = auth.uid();
END;
$$;
ALTER FUNCTION public.get_holdings_secure() OWNER TO postgres;
--
-- Name: get_portfolio_value_daily_secure(); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.get_portfolio_value_daily_secure() RETURNS TABLE(user_id uuid, date date, total_value numeric)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
RETURN QUERY
SELECT p.user_id, p.date, p.total_value
FROM portfolio_value_daily p
WHERE p.user_id = auth.uid();
END;
$$;
ALTER FUNCTION public.get_portfolio_value_daily_secure() OWNER TO postgres;
--
-- Name: refresh_mv(text); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.refresh_mv(_name text) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', _name);
END $$;
ALTER FUNCTION public.refresh_mv(_name text) OWNER TO postgres;
--
-- Name: trg_events_recalc_acct(); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.trg_events_recalc_acct() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
u_old uuid; a_old uuid; acc_old uuid; d_old date;
u_new uuid; a_new uuid; acc_new uuid; d_new date;
BEGIN
IF TG_OP = 'INSERT' THEN
u_new := NEW.user_id; a_new := NEW.asset_id; acc_new := NEW.account_id; d_new := (NEW.tstamp)::date;
IF u_new IS NOT NULL AND a_new IS NOT NULL AND acc_new IS NOT NULL THEN
PERFORM fn_recalc_positions_acct(u_new, acc_new, a_new, COALESCE(d_new, CURRENT_DATE));
END IF;
RETURN NEW;
ELSIF TG_OP = 'UPDATE' THEN
u_old := OLD.user_id; a_old := OLD.asset_id; acc_old := OLD.account_id; d_old := (OLD.tstamp)::date;
u_new := NEW.user_id; a_new := NEW.asset_id; acc_new := NEW.account_id; d_new := (NEW.tstamp)::date;
-- Recalc lado OLD
IF u_old IS NOT NULL AND a_old IS NOT NULL AND acc_old IS NOT NULL THEN
PERFORM fn_recalc_positions_acct(u_old, acc_old, a_old, COALESCE(d_old, d_new, CURRENT_DATE));
END IF;
-- Recalc lado NEW (se mudou algo)
IF (u_new, a_new, acc_new) IS DISTINCT FROM (u_old, a_old, acc_old) OR d_new IS DISTINCT FROM d_old THEN
IF u_new IS NOT NULL AND a_new IS NOT NULL AND acc_new IS NOT NULL THEN
PERFORM fn_recalc_positions_acct(u_new, acc_new, a_new, COALESCE(d_old, d_new, CURRENT_DATE));
END IF;
END IF;
RETURN NEW;
ELSIF TG_OP = 'DELETE' THEN
u_old := OLD.user_id; a_old := OLD.asset_id; acc_old := OLD.account_id; d_old := (OLD.tstamp)::date;
IF u_old IS NOT NULL AND a_old IS NOT NULL AND acc_old IS NOT NULL THEN
PERFORM fn_recalc_positions_acct(u_old, acc_old, a_old, COALESCE(d_old, CURRENT_DATE));
END IF;
RETURN OLD;
END IF;
RETURN NULL;
END$$;
ALTER FUNCTION public.trg_events_recalc_acct() OWNER TO postgres;
--
-- Name: trg_events_recalc_acct_del(); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.trg_events_recalc_acct_del() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE rec RECORD;
BEGIN
FOR rec IN
SELECT user_id, account_id, asset_id,
MIN((tstamp)::date) AS from_date,
MAX((tstamp)::date) AS to_date
FROM old_rows
WHERE user_id IS NOT NULL AND account_id IS NOT NULL AND asset_id IS NOT NULL
GROUP BY 1,2,3
LOOP
PERFORM public.fn_recalc_positions_acct(rec.user_id, rec.account_id, rec.asset_id, rec.from_date);
PERFORM public.fn_dpa_keep_zero_borders(rec.user_id, rec.account_id, rec.asset_id, rec.from_date, COALESCE(rec.to_date, CURRENT_DATE));
END LOOP;
RETURN NULL;
END$$;
ALTER FUNCTION public.trg_events_recalc_acct_del() OWNER TO postgres;
--
-- Name: trg_events_recalc_acct_ins(); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.trg_events_recalc_acct_ins() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE rec RECORD;
BEGIN
FOR rec IN
SELECT user_id, account_id, asset_id,
MIN((tstamp)::date) AS from_date,
MAX((tstamp)::date) AS to_date
FROM new_rows
WHERE user_id IS NOT NULL AND account_id IS NOT NULL AND asset_id IS NOT NULL
GROUP BY 1,2,3
LOOP
PERFORM public.fn_recalc_positions_acct(rec.user_id, rec.account_id, rec.asset_id, rec.from_date);
PERFORM public.fn_dpa_keep_zero_borders(rec.user_id, rec.account_id, rec.asset_id, rec.from_date, COALESCE(rec.to_date, CURRENT_DATE));
END LOOP;
RETURN NULL;
END$$;
ALTER FUNCTION public.trg_events_recalc_acct_ins() OWNER TO postgres;
--
-- Name: trg_events_recalc_acct_upd(); Type: FUNCTION; Schema: public; Owner: postgres
--
CREATE FUNCTION public.trg_events_recalc_acct_upd() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE rec RECORD;
BEGIN
FOR rec IN
WITH rows AS (
SELECT user_id, account_id, asset_id, (tstamp)::date AS d FROM old_rows
UNION ALL
SELECT user_id, account_id, asset_id, (tstamp)::date AS d FROM new_rows
)
SELECT user_id, account_id, asset_id,
MIN(d) AS from_date,
MAX(d) AS to_date
FROM rows
WHERE user_id IS NOT NULL AND account_id IS NOT NULL AND asset_id IS NOT NULL
GROUP BY 1,2,3
LOOP
PERFORM public.fn_recalc_positions_acct(rec.user_id, rec.account_id, rec.asset_id, rec.from_date);
PERFORM public.fn_dpa_keep_zero_borders(rec.user_id, rec.account_id, rec.asset_id, rec.from_date, COALESCE(rec.to_date, CURRENT_DATE));
END LOOP;
RETURN NULL;
END$$;
ALTER FUNCTION public.trg_events_recalc_acct_upd() OWNER TO postgres;
SET default_tablespace = '';
SET default_table_access_method = heap;
--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.accounts (
id uuid DEFAULT gen_random_uuid() NOT NULL,
user_id uuid DEFAULT auth.uid(),
label text NOT NULL,
currency text DEFAULT 'BRL'::text NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.accounts OWNER TO postgres;
--
-- Name: custom_account_valuations; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.custom_account_valuations (
id uuid DEFAULT gen_random_uuid() NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
value numeric(20,10) NOT NULL
);
ALTER TABLE ONLY public.custom_account_valuations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.custom_account_valuations OWNER TO postgres;
--
-- Name: custom_asset_valuations; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.custom_asset_valuations (
id uuid DEFAULT gen_random_uuid() NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
value numeric NOT NULL
);
ALTER TABLE ONLY public.custom_asset_valuations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.custom_asset_valuations OWNER TO postgres;
--
-- Name: custom_assets; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.custom_assets (
id uuid DEFAULT gen_random_uuid() NOT NULL,
user_id uuid NOT NULL,
label text NOT NULL,
currency text NOT NULL,
meta jsonb,
created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.custom_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.custom_assets OWNER TO postgres;
--
-- Name: daily_positions_acct; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
)
PARTITION BY RANGE (date);
ALTER TABLE ONLY public.daily_positions_acct FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_positions_acct OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2010_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2010_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2011_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2011_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2011_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2012_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2012_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2012_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2013_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2013_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2013_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2014_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2014_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2014_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2015_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2015_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2015_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2016_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2016_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2016_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2017_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2017_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2017_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2018_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2018_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2018_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2019_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2019_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2019_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2020_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2020_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2020_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2021_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2021_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2021_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2022_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2022_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2022_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2023_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2023_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2023_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2024_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2024_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2024_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_08 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_09; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_09 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_09 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_10; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_10 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_10 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_11; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_11 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_11 OWNER TO postgres;
--
-- Name: daily_positions_acct_2025_12; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2025_12 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2025_12 OWNER TO postgres;
--
-- Name: daily_positions_acct_2026_01; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2026_01 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2026_01 OWNER TO postgres;
--
-- Name: daily_positions_acct_2026_02; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2026_02 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2026_02 OWNER TO postgres;
--
-- Name: daily_positions_acct_2026_03; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2026_03 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2026_03 OWNER TO postgres;
--
-- Name: daily_positions_acct_2026_04; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2026_04 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2026_04 OWNER TO postgres;
--
-- Name: daily_positions_acct_2026_05; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2026_05 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2026_05 OWNER TO postgres;
--
-- Name: daily_positions_acct_2026_06; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2026_06 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2026_06 OWNER TO postgres;
--
-- Name: daily_positions_acct_2026_07; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2026_07 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2026_07 OWNER TO postgres;
--
-- Name: daily_positions_acct_2026_08; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.daily_positions_acct_2026_08 (
user_id uuid NOT NULL,
account_id uuid NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
units numeric(38,18) NOT NULL,
price numeric(20,10),
value numeric(20,10),
currency text NOT NULL,
source_price text,
is_final boolean DEFAULT true,
CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
);
ALTER TABLE public.daily_positions_acct_2026_08 OWNER TO postgres;
--
-- Name: dim_calendar; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.dim_calendar (
date date NOT NULL
);
ALTER TABLE public.dim_calendar OWNER TO postgres;
--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.events (
id uuid DEFAULT gen_random_uuid() NOT NULL,
user_id uuid NOT NULL,
asset_id uuid NOT NULL,
account_id uuid NOT NULL,
tstamp timestamp with time zone NOT NULL,
kind text NOT NULL,
units_delta numeric,
price_override numeric,
price_close numeric,
meta jsonb DEFAULT '{}'::jsonb,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT events_check CHECK ((((kind = ANY (ARRAY['deposit'::text, 'withdraw'::text, 'transfer'::text])) AND (units_delta IS NOT NULL) AND (price_override IS NULL)) OR ((kind = ANY (ARRAY['buy'::text, 'sell'::text])) AND (units_delta IS NOT NULL) AND (price_close IS NOT NULL)) OR ((kind = 'valuation'::text) AND (price_override IS NOT NULL)))),
CONSTRAINT events_kind_check CHECK ((kind = ANY (ARRAY['deposit'::text, 'withdraw'::text, 'buy'::text, 'sell'::text, 'transfer'::text, 'valuation'::text])))
);
ALTER TABLE ONLY public.events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.events OWNER TO postgres;
--
-- Name: external_items; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.external_items (
id uuid NOT NULL,
user_id uuid,
provider text,
created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.external_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_items OWNER TO postgres;
--
-- Name: global_assets; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.global_assets (
id uuid DEFAULT gen_random_uuid() NOT NULL,
symbol text NOT NULL,
class text NOT NULL,
currency text NOT NULL,
meta jsonb,
created_at timestamp with time zone DEFAULT now(),
manual_price numeric
);
ALTER TABLE public.global_assets OWNER TO postgres;
--
-- Name: global_price_daily; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.global_price_daily (
id uuid DEFAULT gen_random_uuid() NOT NULL,
asset_id uuid NOT NULL,
date date NOT NULL,
price numeric NOT NULL
);
ALTER TABLE public.global_price_daily OWNER TO postgres;
--
-- Name: global_price_daily_filled; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--
CREATE MATERIALIZED VIEW public.global_price_daily_filled AS
WITH bounds AS (
SELECT global_price_daily.asset_id,
min(global_price_daily.date) AS start_date
FROM public.global_price_daily
GROUP BY global_price_daily.asset_id
), calendar AS (
SELECT b.asset_id,
(gs.gs)::date AS date
FROM bounds b,
LATERAL generate_series((b.start_date)::timestamp with time zone, (CURRENT_DATE)::timestamp with time zone, '1 day'::interval) gs(gs)
), marked AS (
SELECT c.asset_id,
c.date,
g.price
FROM (calendar c
LEFT JOIN public.global_price_daily g ON (((g.asset_id = c.asset_id) AND (g.date = c.date))))
), last_date AS (
SELECT m.asset_id,
m.date,
max(
CASE
WHEN (m.price IS NOT NULL) THEN m.date
ELSE NULL::date
END) OVER (PARTITION BY m.asset_id ORDER BY m.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS last_date_with_price
FROM marked m
)
SELECT asset_id,
date,
( SELECT g.price
FROM public.global_price_daily g
WHERE ((g.asset_id = l.asset_id) AND (g.date = l.last_date_with_price))) AS price
FROM last_date l
WHERE (last_date_with_price IS NOT NULL)
ORDER BY asset_id, date
WITH NO DATA;
ALTER MATERIALIZED VIEW public.global_price_daily_filled OWNER TO postgres;
--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: postgres
--
CREATE TABLE public.user_profiles (
user_id uuid NOT NULL,
plan text DEFAULT '''premium''::text'::text NOT NULL,
created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.user_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles OWNER TO postgres;
--
-- Name: portfolio_value_daily_detailed; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--
CREATE MATERIALIZED VIEW public.portfolio_value_daily_detailed AS
WITH users_premium AS (
SELECT user_profiles.user_id
FROM public.user_profiles
WHERE (user_profiles.plan = 'premium'::text)
)
SELECT d.user_id,
d.asset_id,
d.date,
sum(COALESCE(d.value, (0)::numeric)) AS asset_value
FROM (public.daily_positions_acct d
JOIN users_premium up ON ((up.user_id = d.user_id)))
GROUP BY d.user_id, d.asset_id, d.date
WITH NO DATA;
ALTER MATERIALIZED VIEW public.portfolio_value_daily_detailed OWNER TO postgres;
--
-- Name: portfolio_value_daily; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--
CREATE MATERIALIZED VIEW public.portfolio_value_daily AS
SELECT user_id,
date,
sum(asset_value) AS total_value
FROM public.portfolio_value_daily_detailed
GROUP BY user_id, date
WITH NO DATA;
ALTER MATERIALIZED VIEW public.portfolio_value_daily OWNER TO postgres;
--
-- Name: portfolio_value_daily_acct; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--
CREATE MATERIALIZED VIEW public.portfolio_value_daily_acct AS
WITH users_premium AS (
SELECT user_profiles.user_id
FROM public.user_profiles
WHERE (user_profiles.plan = 'premium'::text)
)
SELECT d.user_id,
d.account_id,
d.date,
sum(COALESCE(d.value, (0)::numeric)) AS total_value
FROM (public.daily_positions_acct d
JOIN users_premium up ON ((up.user_id = d.user_id)))
GROUP BY d.user_id, d.account_id, d.date
WITH NO DATA;
ALTER MATERIALIZED VIEW public.portfolio_value_daily_acct OWNER TO postgres;
--
-- Name: portfolio_value_monthly; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--
CREATE MATERIALIZED VIEW public.portfolio_value_monthly AS
SELECT user_id,
(date_trunc('month'::text, (date)::timestamp with time zone))::date AS month,
sum(total_value) AS month_value
FROM public.portfolio_value_daily
GROUP BY user_id, ((date_trunc('month'::text, (date)::timestamp with time zone))::date)
HAVING (abs(sum(total_value)) > 0.000000001)
WITH NO DATA;
ALTER MATERIALIZED VIEW public.portfolio_value_monthly OWNER TO postgres;
--
-- Name: daily_positions_acct_2010_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_01 FOR VALUES FROM ('2010-01-01') TO ('2010-02-01');
--
-- Name: daily_positions_acct_2010_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_02 FOR VALUES FROM ('2010-02-01') TO ('2010-03-01');
--
-- Name: daily_positions_acct_2010_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_03 FOR VALUES FROM ('2010-03-01') TO ('2010-04-01');
--
-- Name: daily_positions_acct_2010_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_04 FOR VALUES FROM ('2010-04-01') TO ('2010-05-01');
--
-- Name: daily_positions_acct_2010_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_05 FOR VALUES FROM ('2010-05-01') TO ('2010-06-01');
--
-- Name: daily_positions_acct_2010_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_06 FOR VALUES FROM ('2010-06-01') TO ('2010-07-01');
--
-- Name: daily_positions_acct_2010_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_07 FOR VALUES FROM ('2010-07-01') TO ('2010-08-01');
--
-- Name: daily_positions_acct_2010_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_08 FOR VALUES FROM ('2010-08-01') TO ('2010-09-01');
--
-- Name: daily_positions_acct_2010_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_09 FOR VALUES FROM ('2010-09-01') TO ('2010-10-01');
--
-- Name: daily_positions_acct_2010_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_10 FOR VALUES FROM ('2010-10-01') TO ('2010-11-01');
--
-- Name: daily_positions_acct_2010_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_11 FOR VALUES FROM ('2010-11-01') TO ('2010-12-01');
--
-- Name: daily_positions_acct_2010_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2010_12 FOR VALUES FROM ('2010-12-01') TO ('2011-01-01');
--
-- Name: daily_positions_acct_2011_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_01 FOR VALUES FROM ('2011-01-01') TO ('2011-02-01');
--
-- Name: daily_positions_acct_2011_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_02 FOR VALUES FROM ('2011-02-01') TO ('2011-03-01');
--
-- Name: daily_positions_acct_2011_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_03 FOR VALUES FROM ('2011-03-01') TO ('2011-04-01');
--
-- Name: daily_positions_acct_2011_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_04 FOR VALUES FROM ('2011-04-01') TO ('2011-05-01');
--
-- Name: daily_positions_acct_2011_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_05 FOR VALUES FROM ('2011-05-01') TO ('2011-06-01');
--
-- Name: daily_positions_acct_2011_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_06 FOR VALUES FROM ('2011-06-01') TO ('2011-07-01');
--
-- Name: daily_positions_acct_2011_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_07 FOR VALUES FROM ('2011-07-01') TO ('2011-08-01');
--
-- Name: daily_positions_acct_2011_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_08 FOR VALUES FROM ('2011-08-01') TO ('2011-09-01');
--
-- Name: daily_positions_acct_2011_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_09 FOR VALUES FROM ('2011-09-01') TO ('2011-10-01');
--
-- Name: daily_positions_acct_2011_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_10 FOR VALUES FROM ('2011-10-01') TO ('2011-11-01');
--
-- Name: daily_positions_acct_2011_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_11 FOR VALUES FROM ('2011-11-01') TO ('2011-12-01');
--
-- Name: daily_positions_acct_2011_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2011_12 FOR VALUES FROM ('2011-12-01') TO ('2012-01-01');
--
-- Name: daily_positions_acct_2012_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_01 FOR VALUES FROM ('2012-01-01') TO ('2012-02-01');
--
-- Name: daily_positions_acct_2012_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_02 FOR VALUES FROM ('2012-02-01') TO ('2012-03-01');
--
-- Name: daily_positions_acct_2012_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_03 FOR VALUES FROM ('2012-03-01') TO ('2012-04-01');
--
-- Name: daily_positions_acct_2012_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_04 FOR VALUES FROM ('2012-04-01') TO ('2012-05-01');
--
-- Name: daily_positions_acct_2012_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_05 FOR VALUES FROM ('2012-05-01') TO ('2012-06-01');
--
-- Name: daily_positions_acct_2012_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_06 FOR VALUES FROM ('2012-06-01') TO ('2012-07-01');
--
-- Name: daily_positions_acct_2012_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_07 FOR VALUES FROM ('2012-07-01') TO ('2012-08-01');
--
-- Name: daily_positions_acct_2012_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_08 FOR VALUES FROM ('2012-08-01') TO ('2012-09-01');
--
-- Name: daily_positions_acct_2012_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_09 FOR VALUES FROM ('2012-09-01') TO ('2012-10-01');
--
-- Name: daily_positions_acct_2012_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_10 FOR VALUES FROM ('2012-10-01') TO ('2012-11-01');
--
-- Name: daily_positions_acct_2012_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_11 FOR VALUES FROM ('2012-11-01') TO ('2012-12-01');
--
-- Name: daily_positions_acct_2012_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2012_12 FOR VALUES FROM ('2012-12-01') TO ('2013-01-01');
--
-- Name: daily_positions_acct_2013_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_01 FOR VALUES FROM ('2013-01-01') TO ('2013-02-01');
--
-- Name: daily_positions_acct_2013_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_02 FOR VALUES FROM ('2013-02-01') TO ('2013-03-01');
--
-- Name: daily_positions_acct_2013_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_03 FOR VALUES FROM ('2013-03-01') TO ('2013-04-01');
--
-- Name: daily_positions_acct_2013_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_04 FOR VALUES FROM ('2013-04-01') TO ('2013-05-01');
--
-- Name: daily_positions_acct_2013_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_05 FOR VALUES FROM ('2013-05-01') TO ('2013-06-01');
--
-- Name: daily_positions_acct_2013_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_06 FOR VALUES FROM ('2013-06-01') TO ('2013-07-01');
--
-- Name: daily_positions_acct_2013_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_07 FOR VALUES FROM ('2013-07-01') TO ('2013-08-01');
--
-- Name: daily_positions_acct_2013_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_08 FOR VALUES FROM ('2013-08-01') TO ('2013-09-01');
--
-- Name: daily_positions_acct_2013_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_09 FOR VALUES FROM ('2013-09-01') TO ('2013-10-01');
--
-- Name: daily_positions_acct_2013_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_10 FOR VALUES FROM ('2013-10-01') TO ('2013-11-01');
--
-- Name: daily_positions_acct_2013_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_11 FOR VALUES FROM ('2013-11-01') TO ('2013-12-01');
--
-- Name: daily_positions_acct_2013_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2013_12 FOR VALUES FROM ('2013-12-01') TO ('2014-01-01');
--
-- Name: daily_positions_acct_2014_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_01 FOR VALUES FROM ('2014-01-01') TO ('2014-02-01');
--
-- Name: daily_positions_acct_2014_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_02 FOR VALUES FROM ('2014-02-01') TO ('2014-03-01');
--
-- Name: daily_positions_acct_2014_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_03 FOR VALUES FROM ('2014-03-01') TO ('2014-04-01');
--
-- Name: daily_positions_acct_2014_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_04 FOR VALUES FROM ('2014-04-01') TO ('2014-05-01');
--
-- Name: daily_positions_acct_2014_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_05 FOR VALUES FROM ('2014-05-01') TO ('2014-06-01');
--
-- Name: daily_positions_acct_2014_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_06 FOR VALUES FROM ('2014-06-01') TO ('2014-07-01');
--
-- Name: daily_positions_acct_2014_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_07 FOR VALUES FROM ('2014-07-01') TO ('2014-08-01');
--
-- Name: daily_positions_acct_2014_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_08 FOR VALUES FROM ('2014-08-01') TO ('2014-09-01');
--
-- Name: daily_positions_acct_2014_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_09 FOR VALUES FROM ('2014-09-01') TO ('2014-10-01');
--
-- Name: daily_positions_acct_2014_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_10 FOR VALUES FROM ('2014-10-01') TO ('2014-11-01');
--
-- Name: daily_positions_acct_2014_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_11 FOR VALUES FROM ('2014-11-01') TO ('2014-12-01');
--
-- Name: daily_positions_acct_2014_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2014_12 FOR VALUES FROM ('2014-12-01') TO ('2015-01-01');
--
-- Name: daily_positions_acct_2015_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_01 FOR VALUES FROM ('2015-01-01') TO ('2015-02-01');
--
-- Name: daily_positions_acct_2015_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_02 FOR VALUES FROM ('2015-02-01') TO ('2015-03-01');
--
-- Name: daily_positions_acct_2015_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_03 FOR VALUES FROM ('2015-03-01') TO ('2015-04-01');
--
-- Name: daily_positions_acct_2015_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_04 FOR VALUES FROM ('2015-04-01') TO ('2015-05-01');
--
-- Name: daily_positions_acct_2015_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_05 FOR VALUES FROM ('2015-05-01') TO ('2015-06-01');
--
-- Name: daily_positions_acct_2015_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_06 FOR VALUES FROM ('2015-06-01') TO ('2015-07-01');
--
-- Name: daily_positions_acct_2015_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_07 FOR VALUES FROM ('2015-07-01') TO ('2015-08-01');
--
-- Name: daily_positions_acct_2015_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_08 FOR VALUES FROM ('2015-08-01') TO ('2015-09-01');
--
-- Name: daily_positions_acct_2015_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_09 FOR VALUES FROM ('2015-09-01') TO ('2015-10-01');
--
-- Name: daily_positions_acct_2015_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_10 FOR VALUES FROM ('2015-10-01') TO ('2015-11-01');
--
-- Name: daily_positions_acct_2015_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_11 FOR VALUES FROM ('2015-11-01') TO ('2015-12-01');
--
-- Name: daily_positions_acct_2015_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2015_12 FOR VALUES FROM ('2015-12-01') TO ('2016-01-01');
--
-- Name: daily_positions_acct_2016_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_01 FOR VALUES FROM ('2016-01-01') TO ('2016-02-01');
--
-- Name: daily_positions_acct_2016_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_02 FOR VALUES FROM ('2016-02-01') TO ('2016-03-01');
--
-- Name: daily_positions_acct_2016_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_03 FOR VALUES FROM ('2016-03-01') TO ('2016-04-01');
--
-- Name: daily_positions_acct_2016_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_04 FOR VALUES FROM ('2016-04-01') TO ('2016-05-01');
--
-- Name: daily_positions_acct_2016_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_05 FOR VALUES FROM ('2016-05-01') TO ('2016-06-01');
--
-- Name: daily_positions_acct_2016_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_06 FOR VALUES FROM ('2016-06-01') TO ('2016-07-01');
--
-- Name: daily_positions_acct_2016_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_07 FOR VALUES FROM ('2016-07-01') TO ('2016-08-01');
--
-- Name: daily_positions_acct_2016_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_08 FOR VALUES FROM ('2016-08-01') TO ('2016-09-01');
--
-- Name: daily_positions_acct_2016_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_09 FOR VALUES FROM ('2016-09-01') TO ('2016-10-01');
--
-- Name: daily_positions_acct_2016_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_10 FOR VALUES FROM ('2016-10-01') TO ('2016-11-01');
--
-- Name: daily_positions_acct_2016_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_11 FOR VALUES FROM ('2016-11-01') TO ('2016-12-01');
--
-- Name: daily_positions_acct_2016_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2016_12 FOR VALUES FROM ('2016-12-01') TO ('2017-01-01');
--
-- Name: daily_positions_acct_2017_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_01 FOR VALUES FROM ('2017-01-01') TO ('2017-02-01');
--
-- Name: daily_positions_acct_2017_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_02 FOR VALUES FROM ('2017-02-01') TO ('2017-03-01');
--
-- Name: daily_positions_acct_2017_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_03 FOR VALUES FROM ('2017-03-01') TO ('2017-04-01');
--
-- Name: daily_positions_acct_2017_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_04 FOR VALUES FROM ('2017-04-01') TO ('2017-05-01');
--
-- Name: daily_positions_acct_2017_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_05 FOR VALUES FROM ('2017-05-01') TO ('2017-06-01');
--
-- Name: daily_positions_acct_2017_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_06 FOR VALUES FROM ('2017-06-01') TO ('2017-07-01');
--
-- Name: daily_positions_acct_2017_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_07 FOR VALUES FROM ('2017-07-01') TO ('2017-08-01');
--
-- Name: daily_positions_acct_2017_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_08 FOR VALUES FROM ('2017-08-01') TO ('2017-09-01');
--
-- Name: daily_positions_acct_2017_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_09 FOR VALUES FROM ('2017-09-01') TO ('2017-10-01');
--
-- Name: daily_positions_acct_2017_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_10 FOR VALUES FROM ('2017-10-01') TO ('2017-11-01');
--
-- Name: daily_positions_acct_2017_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_11 FOR VALUES FROM ('2017-11-01') TO ('2017-12-01');
--
-- Name: daily_positions_acct_2017_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2017_12 FOR VALUES FROM ('2017-12-01') TO ('2018-01-01');
--
-- Name: daily_positions_acct_2018_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_01 FOR VALUES FROM ('2018-01-01') TO ('2018-02-01');
--
-- Name: daily_positions_acct_2018_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_02 FOR VALUES FROM ('2018-02-01') TO ('2018-03-01');
--
-- Name: daily_positions_acct_2018_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_03 FOR VALUES FROM ('2018-03-01') TO ('2018-04-01');
--
-- Name: daily_positions_acct_2018_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_04 FOR VALUES FROM ('2018-04-01') TO ('2018-05-01');
--
-- Name: daily_positions_acct_2018_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_05 FOR VALUES FROM ('2018-05-01') TO ('2018-06-01');
--
-- Name: daily_positions_acct_2018_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_06 FOR VALUES FROM ('2018-06-01') TO ('2018-07-01');
--
-- Name: daily_positions_acct_2018_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_07 FOR VALUES FROM ('2018-07-01') TO ('2018-08-01');
--
-- Name: daily_positions_acct_2018_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_08 FOR VALUES FROM ('2018-08-01') TO ('2018-09-01');
--
-- Name: daily_positions_acct_2018_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_09 FOR VALUES FROM ('2018-09-01') TO ('2018-10-01');
--
-- Name: daily_positions_acct_2018_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_10 FOR VALUES FROM ('2018-10-01') TO ('2018-11-01');
--
-- Name: daily_positions_acct_2018_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_11 FOR VALUES FROM ('2018-11-01') TO ('2018-12-01');
--
-- Name: daily_positions_acct_2018_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2018_12 FOR VALUES FROM ('2018-12-01') TO ('2019-01-01');
--
-- Name: daily_positions_acct_2019_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_01 FOR VALUES FROM ('2019-01-01') TO ('2019-02-01');
--
-- Name: daily_positions_acct_2019_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_02 FOR VALUES FROM ('2019-02-01') TO ('2019-03-01');
--
-- Name: daily_positions_acct_2019_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_03 FOR VALUES FROM ('2019-03-01') TO ('2019-04-01');
--
-- Name: daily_positions_acct_2019_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_04 FOR VALUES FROM ('2019-04-01') TO ('2019-05-01');
--
-- Name: daily_positions_acct_2019_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_05 FOR VALUES FROM ('2019-05-01') TO ('2019-06-01');
--
-- Name: daily_positions_acct_2019_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_06 FOR VALUES FROM ('2019-06-01') TO ('2019-07-01');
--
-- Name: daily_positions_acct_2019_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_07 FOR VALUES FROM ('2019-07-01') TO ('2019-08-01');
--
-- Name: daily_positions_acct_2019_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_08 FOR VALUES FROM ('2019-08-01') TO ('2019-09-01');
--
-- Name: daily_positions_acct_2019_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_09 FOR VALUES FROM ('2019-09-01') TO ('2019-10-01');
--
-- Name: daily_positions_acct_2019_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_10 FOR VALUES FROM ('2019-10-01') TO ('2019-11-01');
--
-- Name: daily_positions_acct_2019_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_11 FOR VALUES FROM ('2019-11-01') TO ('2019-12-01');
--
-- Name: daily_positions_acct_2019_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2019_12 FOR VALUES FROM ('2019-12-01') TO ('2020-01-01');
--
-- Name: daily_positions_acct_2020_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_01 FOR VALUES FROM ('2020-01-01') TO ('2020-02-01');
--
-- Name: daily_positions_acct_2020_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_02 FOR VALUES FROM ('2020-02-01') TO ('2020-03-01');
--
-- Name: daily_positions_acct_2020_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_03 FOR VALUES FROM ('2020-03-01') TO ('2020-04-01');
--
-- Name: daily_positions_acct_2020_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_04 FOR VALUES FROM ('2020-04-01') TO ('2020-05-01');
--
-- Name: daily_positions_acct_2020_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_05 FOR VALUES FROM ('2020-05-01') TO ('2020-06-01');
--
-- Name: daily_positions_acct_2020_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_06 FOR VALUES FROM ('2020-06-01') TO ('2020-07-01');
--
-- Name: daily_positions_acct_2020_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_07 FOR VALUES FROM ('2020-07-01') TO ('2020-08-01');
--
-- Name: daily_positions_acct_2020_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_08 FOR VALUES FROM ('2020-08-01') TO ('2020-09-01');
--
-- Name: daily_positions_acct_2020_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_09 FOR VALUES FROM ('2020-09-01') TO ('2020-10-01');
--
-- Name: daily_positions_acct_2020_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_10 FOR VALUES FROM ('2020-10-01') TO ('2020-11-01');
--
-- Name: daily_positions_acct_2020_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_11 FOR VALUES FROM ('2020-11-01') TO ('2020-12-01');
--
-- Name: daily_positions_acct_2020_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2020_12 FOR VALUES FROM ('2020-12-01') TO ('2021-01-01');
--
-- Name: daily_positions_acct_2021_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_01 FOR VALUES FROM ('2021-01-01') TO ('2021-02-01');
--
-- Name: daily_positions_acct_2021_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_02 FOR VALUES FROM ('2021-02-01') TO ('2021-03-01');
--
-- Name: daily_positions_acct_2021_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_03 FOR VALUES FROM ('2021-03-01') TO ('2021-04-01');
--
-- Name: daily_positions_acct_2021_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_04 FOR VALUES FROM ('2021-04-01') TO ('2021-05-01');
--
-- Name: daily_positions_acct_2021_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_05 FOR VALUES FROM ('2021-05-01') TO ('2021-06-01');
--
-- Name: daily_positions_acct_2021_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_06 FOR VALUES FROM ('2021-06-01') TO ('2021-07-01');
--
-- Name: daily_positions_acct_2021_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_07 FOR VALUES FROM ('2021-07-01') TO ('2021-08-01');
--
-- Name: daily_positions_acct_2021_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_08 FOR VALUES FROM ('2021-08-01') TO ('2021-09-01');
--
-- Name: daily_positions_acct_2021_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_09 FOR VALUES FROM ('2021-09-01') TO ('2021-10-01');
--
-- Name: daily_positions_acct_2021_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_10 FOR VALUES FROM ('2021-10-01') TO ('2021-11-01');
--
-- Name: daily_positions_acct_2021_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_11 FOR VALUES FROM ('2021-11-01') TO ('2021-12-01');
--
-- Name: daily_positions_acct_2021_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2021_12 FOR VALUES FROM ('2021-12-01') TO ('2022-01-01');
--
-- Name: daily_positions_acct_2022_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_01 FOR VALUES FROM ('2022-01-01') TO ('2022-02-01');
--
-- Name: daily_positions_acct_2022_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_02 FOR VALUES FROM ('2022-02-01') TO ('2022-03-01');
--
-- Name: daily_positions_acct_2022_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_03 FOR VALUES FROM ('2022-03-01') TO ('2022-04-01');
--
-- Name: daily_positions_acct_2022_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_04 FOR VALUES FROM ('2022-04-01') TO ('2022-05-01');
--
-- Name: daily_positions_acct_2022_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_05 FOR VALUES FROM ('2022-05-01') TO ('2022-06-01');
--
-- Name: daily_positions_acct_2022_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_06 FOR VALUES FROM ('2022-06-01') TO ('2022-07-01');
--
-- Name: daily_positions_acct_2022_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_07 FOR VALUES FROM ('2022-07-01') TO ('2022-08-01');
--
-- Name: daily_positions_acct_2022_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_08 FOR VALUES FROM ('2022-08-01') TO ('2022-09-01');
--
-- Name: daily_positions_acct_2022_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_09 FOR VALUES FROM ('2022-09-01') TO ('2022-10-01');
--
-- Name: daily_positions_acct_2022_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_10 FOR VALUES FROM ('2022-10-01') TO ('2022-11-01');
--
-- Name: daily_positions_acct_2022_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_11 FOR VALUES FROM ('2022-11-01') TO ('2022-12-01');
--
-- Name: daily_positions_acct_2022_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2022_12 FOR VALUES FROM ('2022-12-01') TO ('2023-01-01');
--
-- Name: daily_positions_acct_2023_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_01 FOR VALUES FROM ('2023-01-01') TO ('2023-02-01');
--
-- Name: daily_positions_acct_2023_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_02 FOR VALUES FROM ('2023-02-01') TO ('2023-03-01');
--
-- Name: daily_positions_acct_2023_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_03 FOR VALUES FROM ('2023-03-01') TO ('2023-04-01');
--
-- Name: daily_positions_acct_2023_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_04 FOR VALUES FROM ('2023-04-01') TO ('2023-05-01');
--
-- Name: daily_positions_acct_2023_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_05 FOR VALUES FROM ('2023-05-01') TO ('2023-06-01');
--
-- Name: daily_positions_acct_2023_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_06 FOR VALUES FROM ('2023-06-01') TO ('2023-07-01');
--
-- Name: daily_positions_acct_2023_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_07 FOR VALUES FROM ('2023-07-01') TO ('2023-08-01');
--
-- Name: daily_positions_acct_2023_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_08 FOR VALUES FROM ('2023-08-01') TO ('2023-09-01');
--
-- Name: daily_positions_acct_2023_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_09 FOR VALUES FROM ('2023-09-01') TO ('2023-10-01');
--
-- Name: daily_positions_acct_2023_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_10 FOR VALUES FROM ('2023-10-01') TO ('2023-11-01');
--
-- Name: daily_positions_acct_2023_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_11 FOR VALUES FROM ('2023-11-01') TO ('2023-12-01');
--
-- Name: daily_positions_acct_2023_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2023_12 FOR VALUES FROM ('2023-12-01') TO ('2024-01-01');
--
-- Name: daily_positions_acct_2024_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_01 FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
--
-- Name: daily_positions_acct_2024_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_02 FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
--
-- Name: daily_positions_acct_2024_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_03 FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
--
-- Name: daily_positions_acct_2024_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_04 FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
--
-- Name: daily_positions_acct_2024_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_05 FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
--
-- Name: daily_positions_acct_2024_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_06 FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
--
-- Name: daily_positions_acct_2024_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_07 FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
--
-- Name: daily_positions_acct_2024_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_08 FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
--
-- Name: daily_positions_acct_2024_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_09 FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
--
-- Name: daily_positions_acct_2024_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_10 FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
--
-- Name: daily_positions_acct_2024_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_11 FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
--
-- Name: daily_positions_acct_2024_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2024_12 FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
--
-- Name: daily_positions_acct_2025_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_01 FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
--
-- Name: daily_positions_acct_2025_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_02 FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
--
-- Name: daily_positions_acct_2025_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_03 FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
--
-- Name: daily_positions_acct_2025_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_04 FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
--
-- Name: daily_positions_acct_2025_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_05 FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
--
-- Name: daily_positions_acct_2025_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_06 FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
--
-- Name: daily_positions_acct_2025_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_07 FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
--
-- Name: daily_positions_acct_2025_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_08 FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
--
-- Name: daily_positions_acct_2025_09; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_09 FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
--
-- Name: daily_positions_acct_2025_10; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_10 FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
--
-- Name: daily_positions_acct_2025_11; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_11 FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
--
-- Name: daily_positions_acct_2025_12; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2025_12 FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
--
-- Name: daily_positions_acct_2026_01; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2026_01 FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
--
-- Name: daily_positions_acct_2026_02; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2026_02 FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
--
-- Name: daily_positions_acct_2026_03; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2026_03 FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
--
-- Name: daily_positions_acct_2026_04; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2026_04 FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
--
-- Name: daily_positions_acct_2026_05; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2026_05 FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
--
-- Name: daily_positions_acct_2026_06; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2026_06 FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
--
-- Name: daily_positions_acct_2026_07; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2026_07 FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
--
-- Name: daily_positions_acct_2026_08; Type: TABLE ATTACH; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct ATTACH PARTITION public.daily_positions_acct_2026_08 FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.accounts
ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);
--
-- Name: custom_account_valuations custom_account_valuations_account_id_asset_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.custom_account_valuations
ADD CONSTRAINT custom_account_valuations_account_id_asset_id_date_key UNIQUE (account_id, asset_id, date);
--
-- Name: custom_account_valuations custom_account_valuations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.custom_account_valuations
ADD CONSTRAINT custom_account_valuations_pkey PRIMARY KEY (id);
--
-- Name: custom_asset_valuations custom_asset_valuations_asset_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.custom_asset_valuations
ADD CONSTRAINT custom_asset_valuations_asset_id_date_key UNIQUE (asset_id, date);
--
-- Name: custom_asset_valuations custom_asset_valuations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.custom_asset_valuations
ADD CONSTRAINT custom_asset_valuations_pkey PRIMARY KEY (id);
--
-- Name: custom_assets custom_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.custom_assets
ADD CONSTRAINT custom_assets_pkey PRIMARY KEY (id);
--
-- Name: daily_positions_acct daily_positions_acct_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct
ADD CONSTRAINT daily_positions_acct_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_01 daily_positions_acct_2010_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_01
ADD CONSTRAINT daily_positions_acct_2010_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_02 daily_positions_acct_2010_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_02
ADD CONSTRAINT daily_positions_acct_2010_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_03 daily_positions_acct_2010_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_03
ADD CONSTRAINT daily_positions_acct_2010_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_04 daily_positions_acct_2010_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_04
ADD CONSTRAINT daily_positions_acct_2010_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_05 daily_positions_acct_2010_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_05
ADD CONSTRAINT daily_positions_acct_2010_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_06 daily_positions_acct_2010_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_06
ADD CONSTRAINT daily_positions_acct_2010_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_07 daily_positions_acct_2010_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_07
ADD CONSTRAINT daily_positions_acct_2010_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_08 daily_positions_acct_2010_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_08
ADD CONSTRAINT daily_positions_acct_2010_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_09 daily_positions_acct_2010_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_09
ADD CONSTRAINT daily_positions_acct_2010_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_10 daily_positions_acct_2010_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_10
ADD CONSTRAINT daily_positions_acct_2010_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_11 daily_positions_acct_2010_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_11
ADD CONSTRAINT daily_positions_acct_2010_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_12 daily_positions_acct_2010_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2010_12
ADD CONSTRAINT daily_positions_acct_2010_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_01 daily_positions_acct_2011_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_01
ADD CONSTRAINT daily_positions_acct_2011_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_02 daily_positions_acct_2011_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_02
ADD CONSTRAINT daily_positions_acct_2011_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_03 daily_positions_acct_2011_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_03
ADD CONSTRAINT daily_positions_acct_2011_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_04 daily_positions_acct_2011_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_04
ADD CONSTRAINT daily_positions_acct_2011_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_05 daily_positions_acct_2011_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_05
ADD CONSTRAINT daily_positions_acct_2011_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_06 daily_positions_acct_2011_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_06
ADD CONSTRAINT daily_positions_acct_2011_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_07 daily_positions_acct_2011_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_07
ADD CONSTRAINT daily_positions_acct_2011_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_08 daily_positions_acct_2011_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_08
ADD CONSTRAINT daily_positions_acct_2011_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_09 daily_positions_acct_2011_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_09
ADD CONSTRAINT daily_positions_acct_2011_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_10 daily_positions_acct_2011_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_10
ADD CONSTRAINT daily_positions_acct_2011_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_11 daily_positions_acct_2011_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_11
ADD CONSTRAINT daily_positions_acct_2011_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_12 daily_positions_acct_2011_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2011_12
ADD CONSTRAINT daily_positions_acct_2011_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_01 daily_positions_acct_2012_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_01
ADD CONSTRAINT daily_positions_acct_2012_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_02 daily_positions_acct_2012_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_02
ADD CONSTRAINT daily_positions_acct_2012_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_03 daily_positions_acct_2012_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_03
ADD CONSTRAINT daily_positions_acct_2012_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_04 daily_positions_acct_2012_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_04
ADD CONSTRAINT daily_positions_acct_2012_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_05 daily_positions_acct_2012_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_05
ADD CONSTRAINT daily_positions_acct_2012_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_06 daily_positions_acct_2012_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_06
ADD CONSTRAINT daily_positions_acct_2012_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_07 daily_positions_acct_2012_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_07
ADD CONSTRAINT daily_positions_acct_2012_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_08 daily_positions_acct_2012_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_08
ADD CONSTRAINT daily_positions_acct_2012_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_09 daily_positions_acct_2012_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_09
ADD CONSTRAINT daily_positions_acct_2012_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_10 daily_positions_acct_2012_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_10
ADD CONSTRAINT daily_positions_acct_2012_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_11 daily_positions_acct_2012_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_11
ADD CONSTRAINT daily_positions_acct_2012_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_12 daily_positions_acct_2012_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2012_12
ADD CONSTRAINT daily_positions_acct_2012_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_01 daily_positions_acct_2013_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_01
ADD CONSTRAINT daily_positions_acct_2013_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_02 daily_positions_acct_2013_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_02
ADD CONSTRAINT daily_positions_acct_2013_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_03 daily_positions_acct_2013_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_03
ADD CONSTRAINT daily_positions_acct_2013_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_04 daily_positions_acct_2013_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_04
ADD CONSTRAINT daily_positions_acct_2013_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_05 daily_positions_acct_2013_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_05
ADD CONSTRAINT daily_positions_acct_2013_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_06 daily_positions_acct_2013_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_06
ADD CONSTRAINT daily_positions_acct_2013_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_07 daily_positions_acct_2013_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_07
ADD CONSTRAINT daily_positions_acct_2013_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_08 daily_positions_acct_2013_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_08
ADD CONSTRAINT daily_positions_acct_2013_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_09 daily_positions_acct_2013_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_09
ADD CONSTRAINT daily_positions_acct_2013_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_10 daily_positions_acct_2013_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_10
ADD CONSTRAINT daily_positions_acct_2013_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_11 daily_positions_acct_2013_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_11
ADD CONSTRAINT daily_positions_acct_2013_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_12 daily_positions_acct_2013_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2013_12
ADD CONSTRAINT daily_positions_acct_2013_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_01 daily_positions_acct_2014_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_01
ADD CONSTRAINT daily_positions_acct_2014_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_02 daily_positions_acct_2014_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_02
ADD CONSTRAINT daily_positions_acct_2014_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_03 daily_positions_acct_2014_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_03
ADD CONSTRAINT daily_positions_acct_2014_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_04 daily_positions_acct_2014_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_04
ADD CONSTRAINT daily_positions_acct_2014_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_05 daily_positions_acct_2014_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_05
ADD CONSTRAINT daily_positions_acct_2014_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_06 daily_positions_acct_2014_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_06
ADD CONSTRAINT daily_positions_acct_2014_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_07 daily_positions_acct_2014_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_07
ADD CONSTRAINT daily_positions_acct_2014_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_08 daily_positions_acct_2014_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_08
ADD CONSTRAINT daily_positions_acct_2014_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_09 daily_positions_acct_2014_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_09
ADD CONSTRAINT daily_positions_acct_2014_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_10 daily_positions_acct_2014_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_10
ADD CONSTRAINT daily_positions_acct_2014_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_11 daily_positions_acct_2014_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_11
ADD CONSTRAINT daily_positions_acct_2014_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_12 daily_positions_acct_2014_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2014_12
ADD CONSTRAINT daily_positions_acct_2014_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_01 daily_positions_acct_2015_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_01
ADD CONSTRAINT daily_positions_acct_2015_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_02 daily_positions_acct_2015_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_02
ADD CONSTRAINT daily_positions_acct_2015_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_03 daily_positions_acct_2015_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_03
ADD CONSTRAINT daily_positions_acct_2015_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_04 daily_positions_acct_2015_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_04
ADD CONSTRAINT daily_positions_acct_2015_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_05 daily_positions_acct_2015_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_05
ADD CONSTRAINT daily_positions_acct_2015_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_06 daily_positions_acct_2015_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_06
ADD CONSTRAINT daily_positions_acct_2015_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_07 daily_positions_acct_2015_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_07
ADD CONSTRAINT daily_positions_acct_2015_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_08 daily_positions_acct_2015_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_08
ADD CONSTRAINT daily_positions_acct_2015_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_09 daily_positions_acct_2015_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_09
ADD CONSTRAINT daily_positions_acct_2015_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_10 daily_positions_acct_2015_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_10
ADD CONSTRAINT daily_positions_acct_2015_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_11 daily_positions_acct_2015_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_11
ADD CONSTRAINT daily_positions_acct_2015_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_12 daily_positions_acct_2015_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2015_12
ADD CONSTRAINT daily_positions_acct_2015_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_01 daily_positions_acct_2016_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_01
ADD CONSTRAINT daily_positions_acct_2016_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_02 daily_positions_acct_2016_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_02
ADD CONSTRAINT daily_positions_acct_2016_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_03 daily_positions_acct_2016_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_03
ADD CONSTRAINT daily_positions_acct_2016_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_04 daily_positions_acct_2016_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_04
ADD CONSTRAINT daily_positions_acct_2016_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_05 daily_positions_acct_2016_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_05
ADD CONSTRAINT daily_positions_acct_2016_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_06 daily_positions_acct_2016_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_06
ADD CONSTRAINT daily_positions_acct_2016_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_07 daily_positions_acct_2016_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_07
ADD CONSTRAINT daily_positions_acct_2016_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_08 daily_positions_acct_2016_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_08
ADD CONSTRAINT daily_positions_acct_2016_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_09 daily_positions_acct_2016_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_09
ADD CONSTRAINT daily_positions_acct_2016_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_10 daily_positions_acct_2016_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_10
ADD CONSTRAINT daily_positions_acct_2016_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_11 daily_positions_acct_2016_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_11
ADD CONSTRAINT daily_positions_acct_2016_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_12 daily_positions_acct_2016_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2016_12
ADD CONSTRAINT daily_positions_acct_2016_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_01 daily_positions_acct_2017_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_01
ADD CONSTRAINT daily_positions_acct_2017_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_02 daily_positions_acct_2017_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_02
ADD CONSTRAINT daily_positions_acct_2017_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_03 daily_positions_acct_2017_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_03
ADD CONSTRAINT daily_positions_acct_2017_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_04 daily_positions_acct_2017_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_04
ADD CONSTRAINT daily_positions_acct_2017_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_05 daily_positions_acct_2017_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_05
ADD CONSTRAINT daily_positions_acct_2017_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_06 daily_positions_acct_2017_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_06
ADD CONSTRAINT daily_positions_acct_2017_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_07 daily_positions_acct_2017_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_07
ADD CONSTRAINT daily_positions_acct_2017_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_08 daily_positions_acct_2017_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_08
ADD CONSTRAINT daily_positions_acct_2017_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_09 daily_positions_acct_2017_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_09
ADD CONSTRAINT daily_positions_acct_2017_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_10 daily_positions_acct_2017_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_10
ADD CONSTRAINT daily_positions_acct_2017_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_11 daily_positions_acct_2017_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_11
ADD CONSTRAINT daily_positions_acct_2017_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_12 daily_positions_acct_2017_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2017_12
ADD CONSTRAINT daily_positions_acct_2017_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_01 daily_positions_acct_2018_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_01
ADD CONSTRAINT daily_positions_acct_2018_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_02 daily_positions_acct_2018_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_02
ADD CONSTRAINT daily_positions_acct_2018_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_03 daily_positions_acct_2018_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_03
ADD CONSTRAINT daily_positions_acct_2018_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_04 daily_positions_acct_2018_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_04
ADD CONSTRAINT daily_positions_acct_2018_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_05 daily_positions_acct_2018_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_05
ADD CONSTRAINT daily_positions_acct_2018_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_06 daily_positions_acct_2018_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_06
ADD CONSTRAINT daily_positions_acct_2018_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_07 daily_positions_acct_2018_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_07
ADD CONSTRAINT daily_positions_acct_2018_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_08 daily_positions_acct_2018_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_08
ADD CONSTRAINT daily_positions_acct_2018_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_09 daily_positions_acct_2018_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_09
ADD CONSTRAINT daily_positions_acct_2018_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_10 daily_positions_acct_2018_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_10
ADD CONSTRAINT daily_positions_acct_2018_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_11 daily_positions_acct_2018_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_11
ADD CONSTRAINT daily_positions_acct_2018_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_12 daily_positions_acct_2018_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2018_12
ADD CONSTRAINT daily_positions_acct_2018_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_01 daily_positions_acct_2019_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_01
ADD CONSTRAINT daily_positions_acct_2019_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_02 daily_positions_acct_2019_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_02
ADD CONSTRAINT daily_positions_acct_2019_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_03 daily_positions_acct_2019_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_03
ADD CONSTRAINT daily_positions_acct_2019_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_04 daily_positions_acct_2019_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_04
ADD CONSTRAINT daily_positions_acct_2019_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_05 daily_positions_acct_2019_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_05
ADD CONSTRAINT daily_positions_acct_2019_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_06 daily_positions_acct_2019_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_06
ADD CONSTRAINT daily_positions_acct_2019_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_07 daily_positions_acct_2019_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_07
ADD CONSTRAINT daily_positions_acct_2019_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_08 daily_positions_acct_2019_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_08
ADD CONSTRAINT daily_positions_acct_2019_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_09 daily_positions_acct_2019_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_09
ADD CONSTRAINT daily_positions_acct_2019_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_10 daily_positions_acct_2019_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_10
ADD CONSTRAINT daily_positions_acct_2019_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_11 daily_positions_acct_2019_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_11
ADD CONSTRAINT daily_positions_acct_2019_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_12 daily_positions_acct_2019_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2019_12
ADD CONSTRAINT daily_positions_acct_2019_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_01 daily_positions_acct_2020_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_01
ADD CONSTRAINT daily_positions_acct_2020_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_02 daily_positions_acct_2020_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_02
ADD CONSTRAINT daily_positions_acct_2020_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_03 daily_positions_acct_2020_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_03
ADD CONSTRAINT daily_positions_acct_2020_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_04 daily_positions_acct_2020_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_04
ADD CONSTRAINT daily_positions_acct_2020_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_05 daily_positions_acct_2020_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_05
ADD CONSTRAINT daily_positions_acct_2020_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_06 daily_positions_acct_2020_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_06
ADD CONSTRAINT daily_positions_acct_2020_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_07 daily_positions_acct_2020_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_07
ADD CONSTRAINT daily_positions_acct_2020_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_08 daily_positions_acct_2020_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_08
ADD CONSTRAINT daily_positions_acct_2020_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_09 daily_positions_acct_2020_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_09
ADD CONSTRAINT daily_positions_acct_2020_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_10 daily_positions_acct_2020_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_10
ADD CONSTRAINT daily_positions_acct_2020_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_11 daily_positions_acct_2020_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_11
ADD CONSTRAINT daily_positions_acct_2020_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_12 daily_positions_acct_2020_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2020_12
ADD CONSTRAINT daily_positions_acct_2020_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_01 daily_positions_acct_2021_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_01
ADD CONSTRAINT daily_positions_acct_2021_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_02 daily_positions_acct_2021_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_02
ADD CONSTRAINT daily_positions_acct_2021_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_03 daily_positions_acct_2021_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_03
ADD CONSTRAINT daily_positions_acct_2021_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_04 daily_positions_acct_2021_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_04
ADD CONSTRAINT daily_positions_acct_2021_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_05 daily_positions_acct_2021_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_05
ADD CONSTRAINT daily_positions_acct_2021_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_06 daily_positions_acct_2021_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_06
ADD CONSTRAINT daily_positions_acct_2021_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_07 daily_positions_acct_2021_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_07
ADD CONSTRAINT daily_positions_acct_2021_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_08 daily_positions_acct_2021_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_08
ADD CONSTRAINT daily_positions_acct_2021_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_09 daily_positions_acct_2021_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_09
ADD CONSTRAINT daily_positions_acct_2021_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_10 daily_positions_acct_2021_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_10
ADD CONSTRAINT daily_positions_acct_2021_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_11 daily_positions_acct_2021_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_11
ADD CONSTRAINT daily_positions_acct_2021_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_12 daily_positions_acct_2021_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2021_12
ADD CONSTRAINT daily_positions_acct_2021_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_01 daily_positions_acct_2022_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_01
ADD CONSTRAINT daily_positions_acct_2022_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_02 daily_positions_acct_2022_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_02
ADD CONSTRAINT daily_positions_acct_2022_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_03 daily_positions_acct_2022_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_03
ADD CONSTRAINT daily_positions_acct_2022_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_04 daily_positions_acct_2022_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_04
ADD CONSTRAINT daily_positions_acct_2022_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_05 daily_positions_acct_2022_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_05
ADD CONSTRAINT daily_positions_acct_2022_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_06 daily_positions_acct_2022_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_06
ADD CONSTRAINT daily_positions_acct_2022_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_07 daily_positions_acct_2022_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_07
ADD CONSTRAINT daily_positions_acct_2022_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_08 daily_positions_acct_2022_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_08
ADD CONSTRAINT daily_positions_acct_2022_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_09 daily_positions_acct_2022_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_09
ADD CONSTRAINT daily_positions_acct_2022_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_10 daily_positions_acct_2022_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_10
ADD CONSTRAINT daily_positions_acct_2022_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_11 daily_positions_acct_2022_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_11
ADD CONSTRAINT daily_positions_acct_2022_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_12 daily_positions_acct_2022_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2022_12
ADD CONSTRAINT daily_positions_acct_2022_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_01 daily_positions_acct_2023_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_01
ADD CONSTRAINT daily_positions_acct_2023_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_02 daily_positions_acct_2023_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_02
ADD CONSTRAINT daily_positions_acct_2023_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_03 daily_positions_acct_2023_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_03
ADD CONSTRAINT daily_positions_acct_2023_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_04 daily_positions_acct_2023_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_04
ADD CONSTRAINT daily_positions_acct_2023_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_05 daily_positions_acct_2023_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_05
ADD CONSTRAINT daily_positions_acct_2023_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_06 daily_positions_acct_2023_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_06
ADD CONSTRAINT daily_positions_acct_2023_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_07 daily_positions_acct_2023_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_07
ADD CONSTRAINT daily_positions_acct_2023_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_08 daily_positions_acct_2023_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_08
ADD CONSTRAINT daily_positions_acct_2023_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_09 daily_positions_acct_2023_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_09
ADD CONSTRAINT daily_positions_acct_2023_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_10 daily_positions_acct_2023_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_10
ADD CONSTRAINT daily_positions_acct_2023_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_11 daily_positions_acct_2023_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_11
ADD CONSTRAINT daily_positions_acct_2023_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_12 daily_positions_acct_2023_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2023_12
ADD CONSTRAINT daily_positions_acct_2023_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_01 daily_positions_acct_2024_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_01
ADD CONSTRAINT daily_positions_acct_2024_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_02 daily_positions_acct_2024_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_02
ADD CONSTRAINT daily_positions_acct_2024_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_03 daily_positions_acct_2024_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_03
ADD CONSTRAINT daily_positions_acct_2024_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_04 daily_positions_acct_2024_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_04
ADD CONSTRAINT daily_positions_acct_2024_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_05 daily_positions_acct_2024_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_05
ADD CONSTRAINT daily_positions_acct_2024_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_06 daily_positions_acct_2024_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_06
ADD CONSTRAINT daily_positions_acct_2024_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_07 daily_positions_acct_2024_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_07
ADD CONSTRAINT daily_positions_acct_2024_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_08 daily_positions_acct_2024_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_08
ADD CONSTRAINT daily_positions_acct_2024_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_09 daily_positions_acct_2024_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_09
ADD CONSTRAINT daily_positions_acct_2024_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_10 daily_positions_acct_2024_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_10
ADD CONSTRAINT daily_positions_acct_2024_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_11 daily_positions_acct_2024_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_11
ADD CONSTRAINT daily_positions_acct_2024_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_12 daily_positions_acct_2024_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2024_12
ADD CONSTRAINT daily_positions_acct_2024_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_01 daily_positions_acct_2025_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_01
ADD CONSTRAINT daily_positions_acct_2025_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_02 daily_positions_acct_2025_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_02
ADD CONSTRAINT daily_positions_acct_2025_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_03 daily_positions_acct_2025_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_03
ADD CONSTRAINT daily_positions_acct_2025_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_04 daily_positions_acct_2025_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_04
ADD CONSTRAINT daily_positions_acct_2025_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_05 daily_positions_acct_2025_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_05
ADD CONSTRAINT daily_positions_acct_2025_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_06 daily_positions_acct_2025_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_06
ADD CONSTRAINT daily_positions_acct_2025_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_07 daily_positions_acct_2025_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_07
ADD CONSTRAINT daily_positions_acct_2025_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_08 daily_positions_acct_2025_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_08
ADD CONSTRAINT daily_positions_acct_2025_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_09 daily_positions_acct_2025_09_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_09
ADD CONSTRAINT daily_positions_acct_2025_09_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_10 daily_positions_acct_2025_10_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_10
ADD CONSTRAINT daily_positions_acct_2025_10_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_11 daily_positions_acct_2025_11_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_11
ADD CONSTRAINT daily_positions_acct_2025_11_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_12 daily_positions_acct_2025_12_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2025_12
ADD CONSTRAINT daily_positions_acct_2025_12_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_01 daily_positions_acct_2026_01_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2026_01
ADD CONSTRAINT daily_positions_acct_2026_01_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_02 daily_positions_acct_2026_02_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2026_02
ADD CONSTRAINT daily_positions_acct_2026_02_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_03 daily_positions_acct_2026_03_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2026_03
ADD CONSTRAINT daily_positions_acct_2026_03_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_04 daily_positions_acct_2026_04_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2026_04
ADD CONSTRAINT daily_positions_acct_2026_04_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_05 daily_positions_acct_2026_05_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2026_05
ADD CONSTRAINT daily_positions_acct_2026_05_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_06 daily_positions_acct_2026_06_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2026_06
ADD CONSTRAINT daily_positions_acct_2026_06_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_07 daily_positions_acct_2026_07_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2026_07
ADD CONSTRAINT daily_positions_acct_2026_07_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_08 daily_positions_acct_2026_08_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.daily_positions_acct_2026_08
ADD CONSTRAINT daily_positions_acct_2026_08_pkey PRIMARY KEY (user_id, account_id, asset_id, date);
--
-- Name: dim_calendar dim_calendar_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.dim_calendar
ADD CONSTRAINT dim_calendar_pkey PRIMARY KEY (date);
--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.events
ADD CONSTRAINT events_pkey PRIMARY KEY (id);
--
-- Name: external_items external_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.external_items
ADD CONSTRAINT external_items_pkey PRIMARY KEY (id);
--
-- Name: global_assets global_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.global_assets
ADD CONSTRAINT global_assets_pkey PRIMARY KEY (id);
--
-- Name: global_price_daily global_price_daily_asset_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.global_price_daily
ADD CONSTRAINT global_price_daily_asset_id_date_key UNIQUE (asset_id, date);
--
-- Name: global_price_daily global_price_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.global_price_daily
ADD CONSTRAINT global_price_daily_pkey PRIMARY KEY (id);
--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.user_profiles
ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);
--
-- Name: ux_dpa_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX ux_dpa_user_acct_asset_date ON ONLY public.daily_positions_acct USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2010_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2010_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2011_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2011_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2011_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2012_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2012_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2012_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2013_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2013_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2013_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2014_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2014_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2014_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2015_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2015_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2015_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2016_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2016_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2016_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2017_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2017_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2017_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2018_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2018_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2018_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2019_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2019_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2019_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2020_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2020_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2020_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2021_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2021_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2021_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2022_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2022_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2022_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2023_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2023_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2023_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2024_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2024_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2024_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_09_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_09_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_10_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_10_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_11_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_11_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2025_12_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2025_12_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2025_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_01_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2026_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2026_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_02_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2026_02_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2026_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_03_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2026_03_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2026_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_04_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2026_04_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2026_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_05_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2026_05_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2026_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_06_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2026_06_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2026_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_07_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2026_07_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2026_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: daily_positions_acct_2026_08_user_id_account_id_asset_id_da_idx; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX daily_positions_acct_2026_08_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2026_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: idx_gpdf_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX idx_gpdf_asset_date ON public.global_price_daily_filled USING btree (asset_id, date);
--
-- Name: idx_pvdd_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX idx_pvdd_user_asset_date ON public.portfolio_value_daily_detailed USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_01_user_acct_asset_date ON public.daily_positions_acct_2010_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_01_user_asset_date ON public.daily_positions_acct_2010_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_01_user_date ON public.daily_positions_acct_2010_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2010_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_02_user_acct_asset_date ON public.daily_positions_acct_2010_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_02_user_asset_date ON public.daily_positions_acct_2010_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_02_user_date ON public.daily_positions_acct_2010_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2010_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_03_user_acct_asset_date ON public.daily_positions_acct_2010_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_03_user_asset_date ON public.daily_positions_acct_2010_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_03_user_date ON public.daily_positions_acct_2010_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2010_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_04_user_acct_asset_date ON public.daily_positions_acct_2010_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_04_user_asset_date ON public.daily_positions_acct_2010_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_04_user_date ON public.daily_positions_acct_2010_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2010_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_05_user_acct_asset_date ON public.daily_positions_acct_2010_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_05_user_asset_date ON public.daily_positions_acct_2010_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_05_user_date ON public.daily_positions_acct_2010_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2010_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_06_user_acct_asset_date ON public.daily_positions_acct_2010_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_06_user_asset_date ON public.daily_positions_acct_2010_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_06_user_date ON public.daily_positions_acct_2010_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2010_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_07_user_acct_asset_date ON public.daily_positions_acct_2010_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_07_user_asset_date ON public.daily_positions_acct_2010_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_07_user_date ON public.daily_positions_acct_2010_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2010_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_08_user_acct_asset_date ON public.daily_positions_acct_2010_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_08_user_asset_date ON public.daily_positions_acct_2010_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_08_user_date ON public.daily_positions_acct_2010_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2010_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_09_user_acct_asset_date ON public.daily_positions_acct_2010_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_09_user_asset_date ON public.daily_positions_acct_2010_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_09_user_date ON public.daily_positions_acct_2010_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2010_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_10_user_acct_asset_date ON public.daily_positions_acct_2010_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_10_user_asset_date ON public.daily_positions_acct_2010_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_10_user_date ON public.daily_positions_acct_2010_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2010_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_11_user_acct_asset_date ON public.daily_positions_acct_2010_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_11_user_asset_date ON public.daily_positions_acct_2010_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_11_user_date ON public.daily_positions_acct_2010_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2010_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_12_user_acct_asset_date ON public.daily_positions_acct_2010_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_12_user_asset_date ON public.daily_positions_acct_2010_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2010_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2010_12_user_date ON public.daily_positions_acct_2010_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_01_user_acct_asset_date ON public.daily_positions_acct_2011_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_01_user_asset_date ON public.daily_positions_acct_2011_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_01_user_date ON public.daily_positions_acct_2011_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_02_user_acct_asset_date ON public.daily_positions_acct_2011_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_02_user_asset_date ON public.daily_positions_acct_2011_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_02_user_date ON public.daily_positions_acct_2011_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_03_user_acct_asset_date ON public.daily_positions_acct_2011_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_03_user_asset_date ON public.daily_positions_acct_2011_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_03_user_date ON public.daily_positions_acct_2011_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_04_user_acct_asset_date ON public.daily_positions_acct_2011_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_04_user_asset_date ON public.daily_positions_acct_2011_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_04_user_date ON public.daily_positions_acct_2011_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_05_user_acct_asset_date ON public.daily_positions_acct_2011_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_05_user_asset_date ON public.daily_positions_acct_2011_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_05_user_date ON public.daily_positions_acct_2011_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_06_user_acct_asset_date ON public.daily_positions_acct_2011_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_06_user_asset_date ON public.daily_positions_acct_2011_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_06_user_date ON public.daily_positions_acct_2011_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_07_user_acct_asset_date ON public.daily_positions_acct_2011_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_07_user_asset_date ON public.daily_positions_acct_2011_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_07_user_date ON public.daily_positions_acct_2011_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_08_user_acct_asset_date ON public.daily_positions_acct_2011_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_08_user_asset_date ON public.daily_positions_acct_2011_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_08_user_date ON public.daily_positions_acct_2011_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_09_user_acct_asset_date ON public.daily_positions_acct_2011_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_09_user_asset_date ON public.daily_positions_acct_2011_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_09_user_date ON public.daily_positions_acct_2011_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_10_user_acct_asset_date ON public.daily_positions_acct_2011_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_10_user_asset_date ON public.daily_positions_acct_2011_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_10_user_date ON public.daily_positions_acct_2011_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_11_user_acct_asset_date ON public.daily_positions_acct_2011_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_11_user_asset_date ON public.daily_positions_acct_2011_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_11_user_date ON public.daily_positions_acct_2011_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2011_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_12_user_acct_asset_date ON public.daily_positions_acct_2011_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_12_user_asset_date ON public.daily_positions_acct_2011_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2011_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2011_12_user_date ON public.daily_positions_acct_2011_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_01_user_acct_asset_date ON public.daily_positions_acct_2012_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_01_user_asset_date ON public.daily_positions_acct_2012_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_01_user_date ON public.daily_positions_acct_2012_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_02_user_acct_asset_date ON public.daily_positions_acct_2012_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_02_user_asset_date ON public.daily_positions_acct_2012_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_02_user_date ON public.daily_positions_acct_2012_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_03_user_acct_asset_date ON public.daily_positions_acct_2012_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_03_user_asset_date ON public.daily_positions_acct_2012_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_03_user_date ON public.daily_positions_acct_2012_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_04_user_acct_asset_date ON public.daily_positions_acct_2012_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_04_user_asset_date ON public.daily_positions_acct_2012_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_04_user_date ON public.daily_positions_acct_2012_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_05_user_acct_asset_date ON public.daily_positions_acct_2012_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_05_user_asset_date ON public.daily_positions_acct_2012_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_05_user_date ON public.daily_positions_acct_2012_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_06_user_acct_asset_date ON public.daily_positions_acct_2012_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_06_user_asset_date ON public.daily_positions_acct_2012_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_06_user_date ON public.daily_positions_acct_2012_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_07_user_acct_asset_date ON public.daily_positions_acct_2012_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_07_user_asset_date ON public.daily_positions_acct_2012_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_07_user_date ON public.daily_positions_acct_2012_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_08_user_acct_asset_date ON public.daily_positions_acct_2012_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_08_user_asset_date ON public.daily_positions_acct_2012_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_08_user_date ON public.daily_positions_acct_2012_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_09_user_acct_asset_date ON public.daily_positions_acct_2012_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_09_user_asset_date ON public.daily_positions_acct_2012_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_09_user_date ON public.daily_positions_acct_2012_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_10_user_acct_asset_date ON public.daily_positions_acct_2012_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_10_user_asset_date ON public.daily_positions_acct_2012_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_10_user_date ON public.daily_positions_acct_2012_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_11_user_acct_asset_date ON public.daily_positions_acct_2012_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_11_user_asset_date ON public.daily_positions_acct_2012_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_11_user_date ON public.daily_positions_acct_2012_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2012_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_12_user_acct_asset_date ON public.daily_positions_acct_2012_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_12_user_asset_date ON public.daily_positions_acct_2012_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2012_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2012_12_user_date ON public.daily_positions_acct_2012_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_01_user_acct_asset_date ON public.daily_positions_acct_2013_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_01_user_asset_date ON public.daily_positions_acct_2013_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_01_user_date ON public.daily_positions_acct_2013_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_02_user_acct_asset_date ON public.daily_positions_acct_2013_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_02_user_asset_date ON public.daily_positions_acct_2013_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_02_user_date ON public.daily_positions_acct_2013_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_03_user_acct_asset_date ON public.daily_positions_acct_2013_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_03_user_asset_date ON public.daily_positions_acct_2013_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_03_user_date ON public.daily_positions_acct_2013_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_04_user_acct_asset_date ON public.daily_positions_acct_2013_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_04_user_asset_date ON public.daily_positions_acct_2013_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_04_user_date ON public.daily_positions_acct_2013_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_05_user_acct_asset_date ON public.daily_positions_acct_2013_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_05_user_asset_date ON public.daily_positions_acct_2013_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_05_user_date ON public.daily_positions_acct_2013_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_06_user_acct_asset_date ON public.daily_positions_acct_2013_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_06_user_asset_date ON public.daily_positions_acct_2013_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_06_user_date ON public.daily_positions_acct_2013_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_07_user_acct_asset_date ON public.daily_positions_acct_2013_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_07_user_asset_date ON public.daily_positions_acct_2013_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_07_user_date ON public.daily_positions_acct_2013_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_08_user_acct_asset_date ON public.daily_positions_acct_2013_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_08_user_asset_date ON public.daily_positions_acct_2013_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_08_user_date ON public.daily_positions_acct_2013_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_09_user_acct_asset_date ON public.daily_positions_acct_2013_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_09_user_asset_date ON public.daily_positions_acct_2013_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_09_user_date ON public.daily_positions_acct_2013_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_10_user_acct_asset_date ON public.daily_positions_acct_2013_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_10_user_asset_date ON public.daily_positions_acct_2013_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_10_user_date ON public.daily_positions_acct_2013_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_11_user_acct_asset_date ON public.daily_positions_acct_2013_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_11_user_asset_date ON public.daily_positions_acct_2013_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_11_user_date ON public.daily_positions_acct_2013_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2013_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_12_user_acct_asset_date ON public.daily_positions_acct_2013_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_12_user_asset_date ON public.daily_positions_acct_2013_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2013_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2013_12_user_date ON public.daily_positions_acct_2013_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_01_user_acct_asset_date ON public.daily_positions_acct_2014_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_01_user_asset_date ON public.daily_positions_acct_2014_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_01_user_date ON public.daily_positions_acct_2014_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_02_user_acct_asset_date ON public.daily_positions_acct_2014_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_02_user_asset_date ON public.daily_positions_acct_2014_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_02_user_date ON public.daily_positions_acct_2014_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_03_user_acct_asset_date ON public.daily_positions_acct_2014_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_03_user_asset_date ON public.daily_positions_acct_2014_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_03_user_date ON public.daily_positions_acct_2014_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_04_user_acct_asset_date ON public.daily_positions_acct_2014_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_04_user_asset_date ON public.daily_positions_acct_2014_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_04_user_date ON public.daily_positions_acct_2014_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_05_user_acct_asset_date ON public.daily_positions_acct_2014_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_05_user_asset_date ON public.daily_positions_acct_2014_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_05_user_date ON public.daily_positions_acct_2014_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_06_user_acct_asset_date ON public.daily_positions_acct_2014_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_06_user_asset_date ON public.daily_positions_acct_2014_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_06_user_date ON public.daily_positions_acct_2014_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_07_user_acct_asset_date ON public.daily_positions_acct_2014_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_07_user_asset_date ON public.daily_positions_acct_2014_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_07_user_date ON public.daily_positions_acct_2014_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_08_user_acct_asset_date ON public.daily_positions_acct_2014_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_08_user_asset_date ON public.daily_positions_acct_2014_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_08_user_date ON public.daily_positions_acct_2014_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_09_user_acct_asset_date ON public.daily_positions_acct_2014_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_09_user_asset_date ON public.daily_positions_acct_2014_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_09_user_date ON public.daily_positions_acct_2014_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_10_user_acct_asset_date ON public.daily_positions_acct_2014_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_10_user_asset_date ON public.daily_positions_acct_2014_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_10_user_date ON public.daily_positions_acct_2014_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_11_user_acct_asset_date ON public.daily_positions_acct_2014_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_11_user_asset_date ON public.daily_positions_acct_2014_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_11_user_date ON public.daily_positions_acct_2014_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2014_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_12_user_acct_asset_date ON public.daily_positions_acct_2014_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_12_user_asset_date ON public.daily_positions_acct_2014_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2014_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2014_12_user_date ON public.daily_positions_acct_2014_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_01_user_acct_asset_date ON public.daily_positions_acct_2015_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_01_user_asset_date ON public.daily_positions_acct_2015_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_01_user_date ON public.daily_positions_acct_2015_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_02_user_acct_asset_date ON public.daily_positions_acct_2015_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_02_user_asset_date ON public.daily_positions_acct_2015_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_02_user_date ON public.daily_positions_acct_2015_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_03_user_acct_asset_date ON public.daily_positions_acct_2015_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_03_user_asset_date ON public.daily_positions_acct_2015_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_03_user_date ON public.daily_positions_acct_2015_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_04_user_acct_asset_date ON public.daily_positions_acct_2015_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_04_user_asset_date ON public.daily_positions_acct_2015_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_04_user_date ON public.daily_positions_acct_2015_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_05_user_acct_asset_date ON public.daily_positions_acct_2015_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_05_user_asset_date ON public.daily_positions_acct_2015_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_05_user_date ON public.daily_positions_acct_2015_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_06_user_acct_asset_date ON public.daily_positions_acct_2015_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_06_user_asset_date ON public.daily_positions_acct_2015_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_06_user_date ON public.daily_positions_acct_2015_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_07_user_acct_asset_date ON public.daily_positions_acct_2015_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_07_user_asset_date ON public.daily_positions_acct_2015_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_07_user_date ON public.daily_positions_acct_2015_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_08_user_acct_asset_date ON public.daily_positions_acct_2015_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_08_user_asset_date ON public.daily_positions_acct_2015_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_08_user_date ON public.daily_positions_acct_2015_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_09_user_acct_asset_date ON public.daily_positions_acct_2015_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_09_user_asset_date ON public.daily_positions_acct_2015_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_09_user_date ON public.daily_positions_acct_2015_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_10_user_acct_asset_date ON public.daily_positions_acct_2015_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_10_user_asset_date ON public.daily_positions_acct_2015_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_10_user_date ON public.daily_positions_acct_2015_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_11_user_acct_asset_date ON public.daily_positions_acct_2015_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_11_user_asset_date ON public.daily_positions_acct_2015_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_11_user_date ON public.daily_positions_acct_2015_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2015_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_12_user_acct_asset_date ON public.daily_positions_acct_2015_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_12_user_asset_date ON public.daily_positions_acct_2015_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2015_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2015_12_user_date ON public.daily_positions_acct_2015_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_01_user_acct_asset_date ON public.daily_positions_acct_2016_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_01_user_asset_date ON public.daily_positions_acct_2016_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_01_user_date ON public.daily_positions_acct_2016_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_02_user_acct_asset_date ON public.daily_positions_acct_2016_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_02_user_asset_date ON public.daily_positions_acct_2016_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_02_user_date ON public.daily_positions_acct_2016_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_03_user_acct_asset_date ON public.daily_positions_acct_2016_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_03_user_asset_date ON public.daily_positions_acct_2016_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_03_user_date ON public.daily_positions_acct_2016_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_04_user_acct_asset_date ON public.daily_positions_acct_2016_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_04_user_asset_date ON public.daily_positions_acct_2016_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_04_user_date ON public.daily_positions_acct_2016_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_05_user_acct_asset_date ON public.daily_positions_acct_2016_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_05_user_asset_date ON public.daily_positions_acct_2016_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_05_user_date ON public.daily_positions_acct_2016_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_06_user_acct_asset_date ON public.daily_positions_acct_2016_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_06_user_asset_date ON public.daily_positions_acct_2016_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_06_user_date ON public.daily_positions_acct_2016_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_07_user_acct_asset_date ON public.daily_positions_acct_2016_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_07_user_asset_date ON public.daily_positions_acct_2016_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_07_user_date ON public.daily_positions_acct_2016_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_08_user_acct_asset_date ON public.daily_positions_acct_2016_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_08_user_asset_date ON public.daily_positions_acct_2016_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_08_user_date ON public.daily_positions_acct_2016_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_09_user_acct_asset_date ON public.daily_positions_acct_2016_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_09_user_asset_date ON public.daily_positions_acct_2016_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_09_user_date ON public.daily_positions_acct_2016_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_10_user_acct_asset_date ON public.daily_positions_acct_2016_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_10_user_asset_date ON public.daily_positions_acct_2016_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_10_user_date ON public.daily_positions_acct_2016_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_11_user_acct_asset_date ON public.daily_positions_acct_2016_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_11_user_asset_date ON public.daily_positions_acct_2016_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_11_user_date ON public.daily_positions_acct_2016_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2016_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_12_user_acct_asset_date ON public.daily_positions_acct_2016_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_12_user_asset_date ON public.daily_positions_acct_2016_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2016_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2016_12_user_date ON public.daily_positions_acct_2016_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_01_user_acct_asset_date ON public.daily_positions_acct_2017_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_01_user_asset_date ON public.daily_positions_acct_2017_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_01_user_date ON public.daily_positions_acct_2017_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_02_user_acct_asset_date ON public.daily_positions_acct_2017_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_02_user_asset_date ON public.daily_positions_acct_2017_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_02_user_date ON public.daily_positions_acct_2017_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_03_user_acct_asset_date ON public.daily_positions_acct_2017_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_03_user_asset_date ON public.daily_positions_acct_2017_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_03_user_date ON public.daily_positions_acct_2017_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_04_user_acct_asset_date ON public.daily_positions_acct_2017_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_04_user_asset_date ON public.daily_positions_acct_2017_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_04_user_date ON public.daily_positions_acct_2017_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_05_user_acct_asset_date ON public.daily_positions_acct_2017_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_05_user_asset_date ON public.daily_positions_acct_2017_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_05_user_date ON public.daily_positions_acct_2017_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_06_user_acct_asset_date ON public.daily_positions_acct_2017_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_06_user_asset_date ON public.daily_positions_acct_2017_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_06_user_date ON public.daily_positions_acct_2017_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_07_user_acct_asset_date ON public.daily_positions_acct_2017_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_07_user_asset_date ON public.daily_positions_acct_2017_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_07_user_date ON public.daily_positions_acct_2017_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_08_user_acct_asset_date ON public.daily_positions_acct_2017_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_08_user_asset_date ON public.daily_positions_acct_2017_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_08_user_date ON public.daily_positions_acct_2017_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_09_user_acct_asset_date ON public.daily_positions_acct_2017_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_09_user_asset_date ON public.daily_positions_acct_2017_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_09_user_date ON public.daily_positions_acct_2017_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_10_user_acct_asset_date ON public.daily_positions_acct_2017_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_10_user_asset_date ON public.daily_positions_acct_2017_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_10_user_date ON public.daily_positions_acct_2017_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_11_user_acct_asset_date ON public.daily_positions_acct_2017_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_11_user_asset_date ON public.daily_positions_acct_2017_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_11_user_date ON public.daily_positions_acct_2017_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2017_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_12_user_acct_asset_date ON public.daily_positions_acct_2017_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_12_user_asset_date ON public.daily_positions_acct_2017_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2017_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2017_12_user_date ON public.daily_positions_acct_2017_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_01_user_acct_asset_date ON public.daily_positions_acct_2018_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_01_user_asset_date ON public.daily_positions_acct_2018_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_01_user_date ON public.daily_positions_acct_2018_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_02_user_acct_asset_date ON public.daily_positions_acct_2018_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_02_user_asset_date ON public.daily_positions_acct_2018_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_02_user_date ON public.daily_positions_acct_2018_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_03_user_acct_asset_date ON public.daily_positions_acct_2018_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_03_user_asset_date ON public.daily_positions_acct_2018_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_03_user_date ON public.daily_positions_acct_2018_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_04_user_acct_asset_date ON public.daily_positions_acct_2018_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_04_user_asset_date ON public.daily_positions_acct_2018_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_04_user_date ON public.daily_positions_acct_2018_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_05_user_acct_asset_date ON public.daily_positions_acct_2018_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_05_user_asset_date ON public.daily_positions_acct_2018_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_05_user_date ON public.daily_positions_acct_2018_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_06_user_acct_asset_date ON public.daily_positions_acct_2018_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_06_user_asset_date ON public.daily_positions_acct_2018_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_06_user_date ON public.daily_positions_acct_2018_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_07_user_acct_asset_date ON public.daily_positions_acct_2018_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_07_user_asset_date ON public.daily_positions_acct_2018_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_07_user_date ON public.daily_positions_acct_2018_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_08_user_acct_asset_date ON public.daily_positions_acct_2018_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_08_user_asset_date ON public.daily_positions_acct_2018_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_08_user_date ON public.daily_positions_acct_2018_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_09_user_acct_asset_date ON public.daily_positions_acct_2018_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_09_user_asset_date ON public.daily_positions_acct_2018_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_09_user_date ON public.daily_positions_acct_2018_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_10_user_acct_asset_date ON public.daily_positions_acct_2018_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_10_user_asset_date ON public.daily_positions_acct_2018_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_10_user_date ON public.daily_positions_acct_2018_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_11_user_acct_asset_date ON public.daily_positions_acct_2018_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_11_user_asset_date ON public.daily_positions_acct_2018_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_11_user_date ON public.daily_positions_acct_2018_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2018_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_12_user_acct_asset_date ON public.daily_positions_acct_2018_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_12_user_asset_date ON public.daily_positions_acct_2018_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2018_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2018_12_user_date ON public.daily_positions_acct_2018_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_01_user_acct_asset_date ON public.daily_positions_acct_2019_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_01_user_asset_date ON public.daily_positions_acct_2019_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_01_user_date ON public.daily_positions_acct_2019_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_02_user_acct_asset_date ON public.daily_positions_acct_2019_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_02_user_asset_date ON public.daily_positions_acct_2019_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_02_user_date ON public.daily_positions_acct_2019_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_03_user_acct_asset_date ON public.daily_positions_acct_2019_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_03_user_asset_date ON public.daily_positions_acct_2019_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_03_user_date ON public.daily_positions_acct_2019_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_04_user_acct_asset_date ON public.daily_positions_acct_2019_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_04_user_asset_date ON public.daily_positions_acct_2019_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_04_user_date ON public.daily_positions_acct_2019_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_05_user_acct_asset_date ON public.daily_positions_acct_2019_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_05_user_asset_date ON public.daily_positions_acct_2019_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_05_user_date ON public.daily_positions_acct_2019_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_06_user_acct_asset_date ON public.daily_positions_acct_2019_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_06_user_asset_date ON public.daily_positions_acct_2019_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_06_user_date ON public.daily_positions_acct_2019_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_07_user_acct_asset_date ON public.daily_positions_acct_2019_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_07_user_asset_date ON public.daily_positions_acct_2019_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_07_user_date ON public.daily_positions_acct_2019_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_08_user_acct_asset_date ON public.daily_positions_acct_2019_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_08_user_asset_date ON public.daily_positions_acct_2019_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_08_user_date ON public.daily_positions_acct_2019_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_09_user_acct_asset_date ON public.daily_positions_acct_2019_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_09_user_asset_date ON public.daily_positions_acct_2019_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_09_user_date ON public.daily_positions_acct_2019_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_10_user_acct_asset_date ON public.daily_positions_acct_2019_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_10_user_asset_date ON public.daily_positions_acct_2019_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_10_user_date ON public.daily_positions_acct_2019_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_11_user_acct_asset_date ON public.daily_positions_acct_2019_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_11_user_asset_date ON public.daily_positions_acct_2019_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_11_user_date ON public.daily_positions_acct_2019_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2019_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_12_user_acct_asset_date ON public.daily_positions_acct_2019_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_12_user_asset_date ON public.daily_positions_acct_2019_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2019_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2019_12_user_date ON public.daily_positions_acct_2019_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_01_user_acct_asset_date ON public.daily_positions_acct_2020_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_01_user_asset_date ON public.daily_positions_acct_2020_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_01_user_date ON public.daily_positions_acct_2020_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_02_user_acct_asset_date ON public.daily_positions_acct_2020_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_02_user_asset_date ON public.daily_positions_acct_2020_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_02_user_date ON public.daily_positions_acct_2020_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_03_user_acct_asset_date ON public.daily_positions_acct_2020_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_03_user_asset_date ON public.daily_positions_acct_2020_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_03_user_date ON public.daily_positions_acct_2020_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_04_user_acct_asset_date ON public.daily_positions_acct_2020_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_04_user_asset_date ON public.daily_positions_acct_2020_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_04_user_date ON public.daily_positions_acct_2020_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_05_user_acct_asset_date ON public.daily_positions_acct_2020_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_05_user_asset_date ON public.daily_positions_acct_2020_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_05_user_date ON public.daily_positions_acct_2020_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_06_user_acct_asset_date ON public.daily_positions_acct_2020_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_06_user_asset_date ON public.daily_positions_acct_2020_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_06_user_date ON public.daily_positions_acct_2020_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_07_user_acct_asset_date ON public.daily_positions_acct_2020_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_07_user_asset_date ON public.daily_positions_acct_2020_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_07_user_date ON public.daily_positions_acct_2020_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_08_user_acct_asset_date ON public.daily_positions_acct_2020_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_08_user_asset_date ON public.daily_positions_acct_2020_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_08_user_date ON public.daily_positions_acct_2020_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_09_user_acct_asset_date ON public.daily_positions_acct_2020_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_09_user_asset_date ON public.daily_positions_acct_2020_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_09_user_date ON public.daily_positions_acct_2020_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_10_user_acct_asset_date ON public.daily_positions_acct_2020_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_10_user_asset_date ON public.daily_positions_acct_2020_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_10_user_date ON public.daily_positions_acct_2020_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_11_user_acct_asset_date ON public.daily_positions_acct_2020_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_11_user_asset_date ON public.daily_positions_acct_2020_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_11_user_date ON public.daily_positions_acct_2020_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2020_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_12_user_acct_asset_date ON public.daily_positions_acct_2020_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_12_user_asset_date ON public.daily_positions_acct_2020_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2020_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2020_12_user_date ON public.daily_positions_acct_2020_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_01_user_acct_asset_date ON public.daily_positions_acct_2021_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_01_user_asset_date ON public.daily_positions_acct_2021_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_01_user_date ON public.daily_positions_acct_2021_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_02_user_acct_asset_date ON public.daily_positions_acct_2021_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_02_user_asset_date ON public.daily_positions_acct_2021_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_02_user_date ON public.daily_positions_acct_2021_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_03_user_acct_asset_date ON public.daily_positions_acct_2021_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_03_user_asset_date ON public.daily_positions_acct_2021_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_03_user_date ON public.daily_positions_acct_2021_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_04_user_acct_asset_date ON public.daily_positions_acct_2021_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_04_user_asset_date ON public.daily_positions_acct_2021_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_04_user_date ON public.daily_positions_acct_2021_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_05_user_acct_asset_date ON public.daily_positions_acct_2021_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_05_user_asset_date ON public.daily_positions_acct_2021_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_05_user_date ON public.daily_positions_acct_2021_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_06_user_acct_asset_date ON public.daily_positions_acct_2021_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_06_user_asset_date ON public.daily_positions_acct_2021_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_06_user_date ON public.daily_positions_acct_2021_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_07_user_acct_asset_date ON public.daily_positions_acct_2021_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_07_user_asset_date ON public.daily_positions_acct_2021_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_07_user_date ON public.daily_positions_acct_2021_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_08_user_acct_asset_date ON public.daily_positions_acct_2021_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_08_user_asset_date ON public.daily_positions_acct_2021_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_08_user_date ON public.daily_positions_acct_2021_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_09_user_acct_asset_date ON public.daily_positions_acct_2021_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_09_user_asset_date ON public.daily_positions_acct_2021_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_09_user_date ON public.daily_positions_acct_2021_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_10_user_acct_asset_date ON public.daily_positions_acct_2021_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_10_user_asset_date ON public.daily_positions_acct_2021_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_10_user_date ON public.daily_positions_acct_2021_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_11_user_acct_asset_date ON public.daily_positions_acct_2021_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_11_user_asset_date ON public.daily_positions_acct_2021_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_11_user_date ON public.daily_positions_acct_2021_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2021_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_12_user_acct_asset_date ON public.daily_positions_acct_2021_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_12_user_asset_date ON public.daily_positions_acct_2021_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2021_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2021_12_user_date ON public.daily_positions_acct_2021_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_01_user_acct_asset_date ON public.daily_positions_acct_2022_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_01_user_asset_date ON public.daily_positions_acct_2022_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_01_user_date ON public.daily_positions_acct_2022_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_02_user_acct_asset_date ON public.daily_positions_acct_2022_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_02_user_asset_date ON public.daily_positions_acct_2022_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_02_user_date ON public.daily_positions_acct_2022_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_03_user_acct_asset_date ON public.daily_positions_acct_2022_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_03_user_asset_date ON public.daily_positions_acct_2022_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_03_user_date ON public.daily_positions_acct_2022_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_04_user_acct_asset_date ON public.daily_positions_acct_2022_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_04_user_asset_date ON public.daily_positions_acct_2022_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_04_user_date ON public.daily_positions_acct_2022_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_05_user_acct_asset_date ON public.daily_positions_acct_2022_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_05_user_asset_date ON public.daily_positions_acct_2022_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_05_user_date ON public.daily_positions_acct_2022_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_06_user_acct_asset_date ON public.daily_positions_acct_2022_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_06_user_asset_date ON public.daily_positions_acct_2022_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_06_user_date ON public.daily_positions_acct_2022_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_07_user_acct_asset_date ON public.daily_positions_acct_2022_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_07_user_asset_date ON public.daily_positions_acct_2022_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_07_user_date ON public.daily_positions_acct_2022_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_08_user_acct_asset_date ON public.daily_positions_acct_2022_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_08_user_asset_date ON public.daily_positions_acct_2022_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_08_user_date ON public.daily_positions_acct_2022_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_09_user_acct_asset_date ON public.daily_positions_acct_2022_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_09_user_asset_date ON public.daily_positions_acct_2022_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_09_user_date ON public.daily_positions_acct_2022_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_10_user_acct_asset_date ON public.daily_positions_acct_2022_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_10_user_asset_date ON public.daily_positions_acct_2022_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_10_user_date ON public.daily_positions_acct_2022_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_11_user_acct_asset_date ON public.daily_positions_acct_2022_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_11_user_asset_date ON public.daily_positions_acct_2022_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_11_user_date ON public.daily_positions_acct_2022_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2022_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_12_user_acct_asset_date ON public.daily_positions_acct_2022_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_12_user_asset_date ON public.daily_positions_acct_2022_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2022_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2022_12_user_date ON public.daily_positions_acct_2022_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_01_user_acct_asset_date ON public.daily_positions_acct_2023_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_01_user_asset_date ON public.daily_positions_acct_2023_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_01_user_date ON public.daily_positions_acct_2023_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_02_user_acct_asset_date ON public.daily_positions_acct_2023_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_02_user_asset_date ON public.daily_positions_acct_2023_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_02_user_date ON public.daily_positions_acct_2023_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_03_user_acct_asset_date ON public.daily_positions_acct_2023_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_03_user_asset_date ON public.daily_positions_acct_2023_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_03_user_date ON public.daily_positions_acct_2023_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_04_user_acct_asset_date ON public.daily_positions_acct_2023_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_04_user_asset_date ON public.daily_positions_acct_2023_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_04_user_date ON public.daily_positions_acct_2023_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_05_user_acct_asset_date ON public.daily_positions_acct_2023_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_05_user_asset_date ON public.daily_positions_acct_2023_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_05_user_date ON public.daily_positions_acct_2023_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_06_user_acct_asset_date ON public.daily_positions_acct_2023_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_06_user_asset_date ON public.daily_positions_acct_2023_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_06_user_date ON public.daily_positions_acct_2023_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_07_user_acct_asset_date ON public.daily_positions_acct_2023_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_07_user_asset_date ON public.daily_positions_acct_2023_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_07_user_date ON public.daily_positions_acct_2023_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_08_user_acct_asset_date ON public.daily_positions_acct_2023_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_08_user_asset_date ON public.daily_positions_acct_2023_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_08_user_date ON public.daily_positions_acct_2023_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_09_user_acct_asset_date ON public.daily_positions_acct_2023_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_09_user_asset_date ON public.daily_positions_acct_2023_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_09_user_date ON public.daily_positions_acct_2023_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_10_user_acct_asset_date ON public.daily_positions_acct_2023_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_10_user_asset_date ON public.daily_positions_acct_2023_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_10_user_date ON public.daily_positions_acct_2023_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_11_user_acct_asset_date ON public.daily_positions_acct_2023_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_11_user_asset_date ON public.daily_positions_acct_2023_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_11_user_date ON public.daily_positions_acct_2023_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2023_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_12_user_acct_asset_date ON public.daily_positions_acct_2023_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_12_user_asset_date ON public.daily_positions_acct_2023_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2023_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2023_12_user_date ON public.daily_positions_acct_2023_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_01_user_acct_asset_date ON public.daily_positions_acct_2024_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_01_user_asset_date ON public.daily_positions_acct_2024_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_01_user_date ON public.daily_positions_acct_2024_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_02_user_acct_asset_date ON public.daily_positions_acct_2024_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_02_user_asset_date ON public.daily_positions_acct_2024_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_02_user_date ON public.daily_positions_acct_2024_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_03_user_acct_asset_date ON public.daily_positions_acct_2024_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_03_user_asset_date ON public.daily_positions_acct_2024_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_03_user_date ON public.daily_positions_acct_2024_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_04_user_acct_asset_date ON public.daily_positions_acct_2024_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_04_user_asset_date ON public.daily_positions_acct_2024_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_04_user_date ON public.daily_positions_acct_2024_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_05_user_acct_asset_date ON public.daily_positions_acct_2024_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_05_user_asset_date ON public.daily_positions_acct_2024_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_05_user_date ON public.daily_positions_acct_2024_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_06_user_acct_asset_date ON public.daily_positions_acct_2024_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_06_user_asset_date ON public.daily_positions_acct_2024_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_06_user_date ON public.daily_positions_acct_2024_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_07_user_acct_asset_date ON public.daily_positions_acct_2024_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_07_user_asset_date ON public.daily_positions_acct_2024_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_07_user_date ON public.daily_positions_acct_2024_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_08_user_acct_asset_date ON public.daily_positions_acct_2024_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_08_user_asset_date ON public.daily_positions_acct_2024_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_08_user_date ON public.daily_positions_acct_2024_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_09_user_acct_asset_date ON public.daily_positions_acct_2024_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_09_user_asset_date ON public.daily_positions_acct_2024_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_09_user_date ON public.daily_positions_acct_2024_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_10_user_acct_asset_date ON public.daily_positions_acct_2024_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_10_user_asset_date ON public.daily_positions_acct_2024_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_10_user_date ON public.daily_positions_acct_2024_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_11_user_acct_asset_date ON public.daily_positions_acct_2024_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_11_user_asset_date ON public.daily_positions_acct_2024_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_11_user_date ON public.daily_positions_acct_2024_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2024_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_12_user_acct_asset_date ON public.daily_positions_acct_2024_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_12_user_asset_date ON public.daily_positions_acct_2024_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2024_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2024_12_user_date ON public.daily_positions_acct_2024_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_01_user_acct_asset_date ON public.daily_positions_acct_2025_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_01_user_asset_date ON public.daily_positions_acct_2025_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_01_user_date ON public.daily_positions_acct_2025_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_02_user_acct_asset_date ON public.daily_positions_acct_2025_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_02_user_asset_date ON public.daily_positions_acct_2025_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_02_user_date ON public.daily_positions_acct_2025_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_03_user_acct_asset_date ON public.daily_positions_acct_2025_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_03_user_asset_date ON public.daily_positions_acct_2025_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_03_user_date ON public.daily_positions_acct_2025_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_04_user_acct_asset_date ON public.daily_positions_acct_2025_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_04_user_asset_date ON public.daily_positions_acct_2025_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_04_user_date ON public.daily_positions_acct_2025_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_05_user_acct_asset_date ON public.daily_positions_acct_2025_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_05_user_asset_date ON public.daily_positions_acct_2025_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_05_user_date ON public.daily_positions_acct_2025_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_06_user_acct_asset_date ON public.daily_positions_acct_2025_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_06_user_asset_date ON public.daily_positions_acct_2025_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_06_user_date ON public.daily_positions_acct_2025_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_07_user_acct_asset_date ON public.daily_positions_acct_2025_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_07_user_asset_date ON public.daily_positions_acct_2025_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_07_user_date ON public.daily_positions_acct_2025_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_08_user_acct_asset_date ON public.daily_positions_acct_2025_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_08_user_asset_date ON public.daily_positions_acct_2025_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_08_user_date ON public.daily_positions_acct_2025_08 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_09_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_09_user_acct_asset_date ON public.daily_positions_acct_2025_09 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_09_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_09_user_asset_date ON public.daily_positions_acct_2025_09 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_09_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_09_user_date ON public.daily_positions_acct_2025_09 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_10_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_10_user_acct_asset_date ON public.daily_positions_acct_2025_10 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_10_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_10_user_asset_date ON public.daily_positions_acct_2025_10 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_10_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_10_user_date ON public.daily_positions_acct_2025_10 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_11_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_11_user_acct_asset_date ON public.daily_positions_acct_2025_11 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_11_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_11_user_asset_date ON public.daily_positions_acct_2025_11 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_11_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_11_user_date ON public.daily_positions_acct_2025_11 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2025_12_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_12_user_acct_asset_date ON public.daily_positions_acct_2025_12 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_12_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_12_user_asset_date ON public.daily_positions_acct_2025_12 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2025_12_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2025_12_user_date ON public.daily_positions_acct_2025_12 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2026_01_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_01_user_acct_asset_date ON public.daily_positions_acct_2026_01 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_01_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_01_user_asset_date ON public.daily_positions_acct_2026_01 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_01_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_01_user_date ON public.daily_positions_acct_2026_01 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2026_02_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_02_user_acct_asset_date ON public.daily_positions_acct_2026_02 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_02_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_02_user_asset_date ON public.daily_positions_acct_2026_02 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_02_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_02_user_date ON public.daily_positions_acct_2026_02 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2026_03_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_03_user_acct_asset_date ON public.daily_positions_acct_2026_03 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_03_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_03_user_asset_date ON public.daily_positions_acct_2026_03 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_03_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_03_user_date ON public.daily_positions_acct_2026_03 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2026_04_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_04_user_acct_asset_date ON public.daily_positions_acct_2026_04 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_04_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_04_user_asset_date ON public.daily_positions_acct_2026_04 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_04_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_04_user_date ON public.daily_positions_acct_2026_04 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2026_05_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_05_user_acct_asset_date ON public.daily_positions_acct_2026_05 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_05_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_05_user_asset_date ON public.daily_positions_acct_2026_05 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_05_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_05_user_date ON public.daily_positions_acct_2026_05 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2026_06_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_06_user_acct_asset_date ON public.daily_positions_acct_2026_06 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_06_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_06_user_asset_date ON public.daily_positions_acct_2026_06 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_06_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_06_user_date ON public.daily_positions_acct_2026_06 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2026_07_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_07_user_acct_asset_date ON public.daily_positions_acct_2026_07 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_07_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_07_user_asset_date ON public.daily_positions_acct_2026_07 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_07_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_07_user_date ON public.daily_positions_acct_2026_07 USING btree (user_id, date);
--
-- Name: ix_daily_positions_acct_2026_08_user_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_08_user_acct_asset_date ON public.daily_positions_acct_2026_08 USING btree (user_id, account_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_08_user_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_08_user_asset_date ON public.daily_positions_acct_2026_08 USING btree (user_id, asset_id, date);
--
-- Name: ix_daily_positions_acct_2026_08_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_daily_positions_acct_2026_08_user_date ON public.daily_positions_acct_2026_08 USING btree (user_id, date);
--
-- Name: ix_events_account_tstamp; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_events_account_tstamp ON public.events USING btree (account_id, tstamp);
--
-- Name: ix_events_user_asset_tstamp; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_events_user_asset_tstamp ON public.events USING btree (user_id, asset_id, tstamp);
--
-- Name: ix_events_user_tstamp; Type: INDEX; Schema: public; Owner: postgres
--
CREATE INDEX ix_events_user_tstamp ON public.events USING btree (user_id, tstamp);
--
-- Name: ux_cav_acct_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX ux_cav_acct_asset_date ON public.custom_account_valuations USING btree (account_id, asset_id, date);
--
-- Name: ux_cav_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX ux_cav_asset_date ON public.custom_asset_valuations USING btree (asset_id, date);
--
-- Name: ux_gpd_asset_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX ux_gpd_asset_date ON public.global_price_daily USING btree (asset_id, date);
--
-- Name: ux_pvd_user_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX ux_pvd_user_date ON public.portfolio_value_daily USING btree (user_id, date);
--
-- Name: ux_pvda_user_acct_date; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX ux_pvda_user_acct_date ON public.portfolio_value_daily_acct USING btree (user_id, account_id, date);
--
-- Name: ux_pvm_user_month; Type: INDEX; Schema: public; Owner: postgres
--
CREATE UNIQUE INDEX ux_pvm_user_month ON public.portfolio_value_monthly USING btree (user_id, month);
--
-- Name: daily_positions_acct_2010_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_01_pkey;
--
-- Name: daily_positions_acct_2010_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2010_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_02_pkey;
--
-- Name: daily_positions_acct_2010_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2010_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_03_pkey;
--
-- Name: daily_positions_acct_2010_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2010_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_04_pkey;
--
-- Name: daily_positions_acct_2010_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2010_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_05_pkey;
--
-- Name: daily_positions_acct_2010_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2010_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_06_pkey;
--
-- Name: daily_positions_acct_2010_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2010_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_07_pkey;
--
-- Name: daily_positions_acct_2010_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2010_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_08_pkey;
--
-- Name: daily_positions_acct_2010_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2010_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_09_pkey;
--
-- Name: daily_positions_acct_2010_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2010_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_10_pkey;
--
-- Name: daily_positions_acct_2010_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2010_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_11_pkey;
--
-- Name: daily_positions_acct_2010_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2010_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2010_12_pkey;
--
-- Name: daily_positions_acct_2010_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2010_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_01_pkey;
--
-- Name: daily_positions_acct_2011_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_02_pkey;
--
-- Name: daily_positions_acct_2011_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_03_pkey;
--
-- Name: daily_positions_acct_2011_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_04_pkey;
--
-- Name: daily_positions_acct_2011_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_05_pkey;
--
-- Name: daily_positions_acct_2011_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_06_pkey;
--
-- Name: daily_positions_acct_2011_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_07_pkey;
--
-- Name: daily_positions_acct_2011_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_08_pkey;
--
-- Name: daily_positions_acct_2011_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_09_pkey;
--
-- Name: daily_positions_acct_2011_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_10_pkey;
--
-- Name: daily_positions_acct_2011_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_11_pkey;
--
-- Name: daily_positions_acct_2011_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2011_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2011_12_pkey;
--
-- Name: daily_positions_acct_2011_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2011_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_01_pkey;
--
-- Name: daily_positions_acct_2012_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_02_pkey;
--
-- Name: daily_positions_acct_2012_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_03_pkey;
--
-- Name: daily_positions_acct_2012_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_04_pkey;
--
-- Name: daily_positions_acct_2012_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_05_pkey;
--
-- Name: daily_positions_acct_2012_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_06_pkey;
--
-- Name: daily_positions_acct_2012_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_07_pkey;
--
-- Name: daily_positions_acct_2012_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_08_pkey;
--
-- Name: daily_positions_acct_2012_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_09_pkey;
--
-- Name: daily_positions_acct_2012_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_10_pkey;
--
-- Name: daily_positions_acct_2012_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_11_pkey;
--
-- Name: daily_positions_acct_2012_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2012_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2012_12_pkey;
--
-- Name: daily_positions_acct_2012_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2012_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_01_pkey;
--
-- Name: daily_positions_acct_2013_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_02_pkey;
--
-- Name: daily_positions_acct_2013_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_03_pkey;
--
-- Name: daily_positions_acct_2013_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_04_pkey;
--
-- Name: daily_positions_acct_2013_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_05_pkey;
--
-- Name: daily_positions_acct_2013_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_06_pkey;
--
-- Name: daily_positions_acct_2013_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_07_pkey;
--
-- Name: daily_positions_acct_2013_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_08_pkey;
--
-- Name: daily_positions_acct_2013_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_09_pkey;
--
-- Name: daily_positions_acct_2013_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_10_pkey;
--
-- Name: daily_positions_acct_2013_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_11_pkey;
--
-- Name: daily_positions_acct_2013_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2013_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2013_12_pkey;
--
-- Name: daily_positions_acct_2013_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2013_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_01_pkey;
--
-- Name: daily_positions_acct_2014_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_02_pkey;
--
-- Name: daily_positions_acct_2014_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_03_pkey;
--
-- Name: daily_positions_acct_2014_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_04_pkey;
--
-- Name: daily_positions_acct_2014_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_05_pkey;
--
-- Name: daily_positions_acct_2014_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_06_pkey;
--
-- Name: daily_positions_acct_2014_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_07_pkey;
--
-- Name: daily_positions_acct_2014_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_08_pkey;
--
-- Name: daily_positions_acct_2014_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_09_pkey;
--
-- Name: daily_positions_acct_2014_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_10_pkey;
--
-- Name: daily_positions_acct_2014_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_11_pkey;
--
-- Name: daily_positions_acct_2014_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2014_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2014_12_pkey;
--
-- Name: daily_positions_acct_2014_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2014_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_01_pkey;
--
-- Name: daily_positions_acct_2015_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_02_pkey;
--
-- Name: daily_positions_acct_2015_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_03_pkey;
--
-- Name: daily_positions_acct_2015_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_04_pkey;
--
-- Name: daily_positions_acct_2015_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_05_pkey;
--
-- Name: daily_positions_acct_2015_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_06_pkey;
--
-- Name: daily_positions_acct_2015_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_07_pkey;
--
-- Name: daily_positions_acct_2015_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_08_pkey;
--
-- Name: daily_positions_acct_2015_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_09_pkey;
--
-- Name: daily_positions_acct_2015_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_10_pkey;
--
-- Name: daily_positions_acct_2015_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_11_pkey;
--
-- Name: daily_positions_acct_2015_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2015_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2015_12_pkey;
--
-- Name: daily_positions_acct_2015_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2015_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_01_pkey;
--
-- Name: daily_positions_acct_2016_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_02_pkey;
--
-- Name: daily_positions_acct_2016_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_03_pkey;
--
-- Name: daily_positions_acct_2016_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_04_pkey;
--
-- Name: daily_positions_acct_2016_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_05_pkey;
--
-- Name: daily_positions_acct_2016_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_06_pkey;
--
-- Name: daily_positions_acct_2016_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_07_pkey;
--
-- Name: daily_positions_acct_2016_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_08_pkey;
--
-- Name: daily_positions_acct_2016_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_09_pkey;
--
-- Name: daily_positions_acct_2016_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_10_pkey;
--
-- Name: daily_positions_acct_2016_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_11_pkey;
--
-- Name: daily_positions_acct_2016_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2016_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2016_12_pkey;
--
-- Name: daily_positions_acct_2016_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2016_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_01_pkey;
--
-- Name: daily_positions_acct_2017_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_02_pkey;
--
-- Name: daily_positions_acct_2017_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_03_pkey;
--
-- Name: daily_positions_acct_2017_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_04_pkey;
--
-- Name: daily_positions_acct_2017_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_05_pkey;
--
-- Name: daily_positions_acct_2017_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_06_pkey;
--
-- Name: daily_positions_acct_2017_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_07_pkey;
--
-- Name: daily_positions_acct_2017_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_08_pkey;
--
-- Name: daily_positions_acct_2017_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_09_pkey;
--
-- Name: daily_positions_acct_2017_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_10_pkey;
--
-- Name: daily_positions_acct_2017_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_11_pkey;
--
-- Name: daily_positions_acct_2017_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2017_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2017_12_pkey;
--
-- Name: daily_positions_acct_2017_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2017_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_01_pkey;
--
-- Name: daily_positions_acct_2018_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_02_pkey;
--
-- Name: daily_positions_acct_2018_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_03_pkey;
--
-- Name: daily_positions_acct_2018_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_04_pkey;
--
-- Name: daily_positions_acct_2018_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_05_pkey;
--
-- Name: daily_positions_acct_2018_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_06_pkey;
--
-- Name: daily_positions_acct_2018_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_07_pkey;
--
-- Name: daily_positions_acct_2018_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_08_pkey;
--
-- Name: daily_positions_acct_2018_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_09_pkey;
--
-- Name: daily_positions_acct_2018_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_10_pkey;
--
-- Name: daily_positions_acct_2018_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_11_pkey;
--
-- Name: daily_positions_acct_2018_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2018_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2018_12_pkey;
--
-- Name: daily_positions_acct_2018_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2018_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_01_pkey;
--
-- Name: daily_positions_acct_2019_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_02_pkey;
--
-- Name: daily_positions_acct_2019_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_03_pkey;
--
-- Name: daily_positions_acct_2019_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_04_pkey;
--
-- Name: daily_positions_acct_2019_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_05_pkey;
--
-- Name: daily_positions_acct_2019_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_06_pkey;
--
-- Name: daily_positions_acct_2019_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_07_pkey;
--
-- Name: daily_positions_acct_2019_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_08_pkey;
--
-- Name: daily_positions_acct_2019_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_09_pkey;
--
-- Name: daily_positions_acct_2019_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_10_pkey;
--
-- Name: daily_positions_acct_2019_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_11_pkey;
--
-- Name: daily_positions_acct_2019_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2019_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2019_12_pkey;
--
-- Name: daily_positions_acct_2019_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2019_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_01_pkey;
--
-- Name: daily_positions_acct_2020_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_02_pkey;
--
-- Name: daily_positions_acct_2020_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_03_pkey;
--
-- Name: daily_positions_acct_2020_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_04_pkey;
--
-- Name: daily_positions_acct_2020_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_05_pkey;
--
-- Name: daily_positions_acct_2020_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_06_pkey;
--
-- Name: daily_positions_acct_2020_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_07_pkey;
--
-- Name: daily_positions_acct_2020_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_08_pkey;
--
-- Name: daily_positions_acct_2020_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_09_pkey;
--
-- Name: daily_positions_acct_2020_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_10_pkey;
--
-- Name: daily_positions_acct_2020_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_11_pkey;
--
-- Name: daily_positions_acct_2020_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2020_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2020_12_pkey;
--
-- Name: daily_positions_acct_2020_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2020_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_01_pkey;
--
-- Name: daily_positions_acct_2021_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_02_pkey;
--
-- Name: daily_positions_acct_2021_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_03_pkey;
--
-- Name: daily_positions_acct_2021_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_04_pkey;
--
-- Name: daily_positions_acct_2021_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_05_pkey;
--
-- Name: daily_positions_acct_2021_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_06_pkey;
--
-- Name: daily_positions_acct_2021_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_07_pkey;
--
-- Name: daily_positions_acct_2021_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_08_pkey;
--
-- Name: daily_positions_acct_2021_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_09_pkey;
--
-- Name: daily_positions_acct_2021_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_10_pkey;
--
-- Name: daily_positions_acct_2021_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_11_pkey;
--
-- Name: daily_positions_acct_2021_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2021_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2021_12_pkey;
--
-- Name: daily_positions_acct_2021_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2021_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_01_pkey;
--
-- Name: daily_positions_acct_2022_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_02_pkey;
--
-- Name: daily_positions_acct_2022_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_03_pkey;
--
-- Name: daily_positions_acct_2022_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_04_pkey;
--
-- Name: daily_positions_acct_2022_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_05_pkey;
--
-- Name: daily_positions_acct_2022_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_06_pkey;
--
-- Name: daily_positions_acct_2022_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_07_pkey;
--
-- Name: daily_positions_acct_2022_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_08_pkey;
--
-- Name: daily_positions_acct_2022_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_09_pkey;
--
-- Name: daily_positions_acct_2022_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_10_pkey;
--
-- Name: daily_positions_acct_2022_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_11_pkey;
--
-- Name: daily_positions_acct_2022_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2022_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2022_12_pkey;
--
-- Name: daily_positions_acct_2022_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2022_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_01_pkey;
--
-- Name: daily_positions_acct_2023_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_02_pkey;
--
-- Name: daily_positions_acct_2023_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_03_pkey;
--
-- Name: daily_positions_acct_2023_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_04_pkey;
--
-- Name: daily_positions_acct_2023_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_05_pkey;
--
-- Name: daily_positions_acct_2023_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_06_pkey;
--
-- Name: daily_positions_acct_2023_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_07_pkey;
--
-- Name: daily_positions_acct_2023_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_08_pkey;
--
-- Name: daily_positions_acct_2023_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_09_pkey;
--
-- Name: daily_positions_acct_2023_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_10_pkey;
--
-- Name: daily_positions_acct_2023_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_11_pkey;
--
-- Name: daily_positions_acct_2023_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2023_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2023_12_pkey;
--
-- Name: daily_positions_acct_2023_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2023_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_01_pkey;
--
-- Name: daily_positions_acct_2024_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_02_pkey;
--
-- Name: daily_positions_acct_2024_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_03_pkey;
--
-- Name: daily_positions_acct_2024_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_04_pkey;
--
-- Name: daily_positions_acct_2024_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_05_pkey;
--
-- Name: daily_positions_acct_2024_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_06_pkey;
--
-- Name: daily_positions_acct_2024_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_07_pkey;
--
-- Name: daily_positions_acct_2024_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_08_pkey;
--
-- Name: daily_positions_acct_2024_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_09_pkey;
--
-- Name: daily_positions_acct_2024_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_10_pkey;
--
-- Name: daily_positions_acct_2024_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_11_pkey;
--
-- Name: daily_positions_acct_2024_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2024_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2024_12_pkey;
--
-- Name: daily_positions_acct_2024_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2024_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_01_pkey;
--
-- Name: daily_positions_acct_2025_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_02_pkey;
--
-- Name: daily_positions_acct_2025_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_03_pkey;
--
-- Name: daily_positions_acct_2025_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_04_pkey;
--
-- Name: daily_positions_acct_2025_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_05_pkey;
--
-- Name: daily_positions_acct_2025_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_06_pkey;
--
-- Name: daily_positions_acct_2025_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_07_pkey;
--
-- Name: daily_positions_acct_2025_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_08_pkey;
--
-- Name: daily_positions_acct_2025_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_08_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_09_pkey;
--
-- Name: daily_positions_acct_2025_09_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_09_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_10_pkey;
--
-- Name: daily_positions_acct_2025_10_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_10_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_11_pkey;
--
-- Name: daily_positions_acct_2025_11_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_11_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2025_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2025_12_pkey;
--
-- Name: daily_positions_acct_2025_12_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2025_12_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2026_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2026_01_pkey;
--
-- Name: daily_positions_acct_2026_01_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2026_01_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2026_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2026_02_pkey;
--
-- Name: daily_positions_acct_2026_02_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2026_02_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2026_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2026_03_pkey;
--
-- Name: daily_positions_acct_2026_03_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2026_03_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2026_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2026_04_pkey;
--
-- Name: daily_positions_acct_2026_04_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2026_04_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2026_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2026_05_pkey;
--
-- Name: daily_positions_acct_2026_05_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2026_05_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2026_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2026_06_pkey;
--
-- Name: daily_positions_acct_2026_06_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2026_06_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2026_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2026_07_pkey;
--
-- Name: daily_positions_acct_2026_07_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2026_07_user_id_account_id_asset_id_da_idx;
--
-- Name: daily_positions_acct_2026_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.daily_positions_acct_pkey ATTACH PARTITION public.daily_positions_acct_2026_08_pkey;
--
-- Name: daily_positions_acct_2026_08_user_id_account_id_asset_id_da_idx; Type: INDEX ATTACH; Schema: public; Owner: postgres
--
ALTER INDEX public.ux_dpa_user_acct_asset_date ATTACH PARTITION public.daily_positions_acct_2026_08_user_id_account_id_asset_id_da_idx;
--
-- Name: events t_events_recalc_acct_del; Type: TRIGGER; Schema: public; Owner: postgres
--
CREATE TRIGGER t_events_recalc_acct_del AFTER DELETE ON public.events REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_events_recalc_acct_del();
--
-- Name: events t_events_recalc_acct_ins; Type: TRIGGER; Schema: public; Owner: postgres
--
CREATE TRIGGER t_events_recalc_acct_ins AFTER INSERT ON public.events REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_events_recalc_acct_ins();
--
-- Name: events t_events_recalc_acct_upd; Type: TRIGGER; Schema: public; Owner: postgres
--
CREATE TRIGGER t_events_recalc_acct_upd AFTER UPDATE ON public.events REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_events_recalc_acct_upd();
--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.accounts
ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--
-- Name: custom_asset_valuations custom_asset_valuations_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.custom_asset_valuations
ADD CONSTRAINT custom_asset_valuations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.custom_assets(id) ON DELETE CASCADE;
--
-- Name: custom_assets custom_assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.custom_assets
ADD CONSTRAINT custom_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
--
-- Name: events events_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.events
ADD CONSTRAINT events_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);
--
-- Name: events events_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.events
ADD CONSTRAINT events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.global_assets(id);
--
-- Name: events events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.events
ADD CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
--
-- Name: external_items external_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.external_items
ADD CONSTRAINT external_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
--
-- Name: global_price_daily global_price_daily_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.global_price_daily
ADD CONSTRAINT global_price_daily_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.global_assets(id) ON DELETE CASCADE;
--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--
ALTER TABLE ONLY public.user_profiles
ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--
-- Name: accounts acc_del; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY acc_del ON public.accounts FOR DELETE USING ((user_id = public.app_current_user()));
--
-- Name: accounts acc_ins; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY acc_ins ON public.accounts FOR INSERT WITH CHECK ((user_id = public.app_current_user()));
--
-- Name: accounts acc_sel; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY acc_sel ON public.accounts FOR SELECT USING ((user_id = public.app_current_user()));
--
-- Name: accounts acc_upd; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY acc_upd ON public.accounts FOR UPDATE USING ((user_id = public.app_current_user())) WITH CHECK ((user_id = public.app_current_user()));
--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: postgres
--
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
--
-- Name: custom_assets ca_del; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ca_del ON public.custom_assets FOR DELETE USING ((user_id = public.app_current_user()));
--
-- Name: custom_assets ca_ins; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ca_ins ON public.custom_assets FOR INSERT WITH CHECK ((user_id = public.app_current_user()));
--
-- Name: custom_assets ca_sel; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ca_sel ON public.custom_assets FOR SELECT USING ((user_id = public.app_current_user()));
--
-- Name: custom_assets ca_upd; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ca_upd ON public.custom_assets FOR UPDATE USING ((user_id = public.app_current_user())) WITH CHECK ((user_id = public.app_current_user()));
--
-- Name: custom_account_valuations cav_acct_del; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY cav_acct_del ON public.custom_account_valuations FOR DELETE USING ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user())))));
--
-- Name: custom_account_valuations cav_acct_ins; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY cav_acct_ins ON public.custom_account_valuations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user())))));
--
-- Name: custom_account_valuations cav_acct_sel; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY cav_acct_sel ON public.custom_account_valuations FOR SELECT USING ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user())))));
--
-- Name: custom_account_valuations cav_acct_upd; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY cav_acct_upd ON public.custom_account_valuations FOR UPDATE USING ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user()))))) WITH CHECK ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user())))));
--
-- Name: custom_asset_valuations cav_del; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY cav_del ON public.custom_asset_valuations FOR DELETE USING ((EXISTS ( SELECT 1
FROM public.custom_assets a
WHERE ((a.id = custom_asset_valuations.asset_id) AND (a.user_id = public.app_current_user())))));
--
-- Name: custom_asset_valuations cav_ins; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY cav_ins ON public.custom_asset_valuations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
FROM public.custom_assets a
WHERE ((a.id = custom_asset_valuations.asset_id) AND (a.user_id = public.app_current_user())))));
--
-- Name: custom_asset_valuations cav_sel; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY cav_sel ON public.custom_asset_valuations FOR SELECT USING ((EXISTS ( SELECT 1
FROM public.custom_assets a
WHERE ((a.id = custom_asset_valuations.asset_id) AND (a.user_id = public.app_current_user())))));
--
-- Name: custom_asset_valuations cav_upd; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY cav_upd ON public.custom_asset_valuations FOR UPDATE USING ((EXISTS ( SELECT 1
FROM public.custom_assets a
WHERE ((a.id = custom_asset_valuations.asset_id) AND (a.user_id = public.app_current_user()))))) WITH CHECK ((EXISTS ( SELECT 1
FROM public.custom_assets a
WHERE ((a.id = custom_asset_valuations.asset_id) AND (a.user_id = public.app_current_user())))));
--
-- Name: custom_account_valuations; Type: ROW SECURITY; Schema: public; Owner: postgres
--
ALTER TABLE public.custom_account_valuations ENABLE ROW LEVEL SECURITY;
--
-- Name: custom_asset_valuations; Type: ROW SECURITY; Schema: public; Owner: postgres
--
ALTER TABLE public.custom_asset_valuations ENABLE ROW LEVEL SECURITY;
--
-- Name: custom_assets; Type: ROW SECURITY; Schema: public; Owner: postgres
--
ALTER TABLE public.custom_assets ENABLE ROW LEVEL SECURITY;
--
-- Name: daily_positions_acct; Type: ROW SECURITY; Schema: public; Owner: postgres
--
ALTER TABLE public.daily_positions_acct ENABLE ROW LEVEL SECURITY;
--
-- Name: daily_positions_acct dpa_sel; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY dpa_sel ON public.daily_positions_acct FOR SELECT USING ((user_id = public.app_current_user()));
--
-- Name: external_items ei_del; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ei_del ON public.external_items FOR DELETE USING ((user_id = public.app_current_user()));
--
-- Name: external_items ei_ins; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ei_ins ON public.external_items FOR INSERT WITH CHECK ((user_id = public.app_current_user()));
--
-- Name: external_items ei_sel; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ei_sel ON public.external_items FOR SELECT USING ((user_id = public.app_current_user()));
--
-- Name: external_items ei_upd; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ei_upd ON public.external_items FOR UPDATE USING ((user_id = public.app_current_user())) WITH CHECK ((user_id = public.app_current_user()));
--
-- Name: events ev_del; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ev_del ON public.events FOR DELETE USING ((user_id = public.app_current_user()));
--
-- Name: events ev_ins; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ev_ins ON public.events FOR INSERT WITH CHECK ((user_id = public.app_current_user()));
--
-- Name: events ev_sel; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ev_sel ON public.events FOR SELECT USING ((user_id = public.app_current_user()));
--
-- Name: events ev_upd; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY ev_upd ON public.events FOR UPDATE USING ((user_id = public.app_current_user())) WITH CHECK ((user_id = public.app_current_user()));
--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: postgres
--
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
--
-- Name: external_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--
ALTER TABLE public.external_items ENABLE ROW LEVEL SECURITY;
--
-- Name: custom_account_valuations p_cav_select; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY p_cav_select ON public.custom_account_valuations FOR SELECT USING ((EXISTS ( SELECT 1
FROM public.accounts a
WHERE ((a.id = custom_account_valuations.account_id) AND (a.user_id = public.app_current_user())))));
--
-- Name: events p_events_select; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY p_events_select ON public.events FOR SELECT USING ((user_id = public.app_current_user()));
--
-- Name: user_profiles prof_self_insert; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY prof_self_insert ON public.user_profiles FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
--
-- Name: user_profiles prof_self_select; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY prof_self_select ON public.user_profiles FOR SELECT USING ((user_id = auth.uid()));
--
-- Name: user_profiles prof_self_update; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY prof_self_update ON public.user_profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
--
-- Name: user_profiles up_del; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY up_del ON public.user_profiles FOR DELETE USING ((user_id = public.app_current_user()));
--
-- Name: user_profiles up_ins; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY up_ins ON public.user_profiles FOR INSERT WITH CHECK ((user_id = public.app_current_user()));
--
-- Name: user_profiles up_sel; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY up_sel ON public.user_profiles FOR SELECT USING ((user_id = public.app_current_user()));
--
-- Name: user_profiles up_upd; Type: POLICY; Schema: public; Owner: postgres
--
CREATE POLICY up_upd ON public.user_profiles FOR UPDATE USING ((user_id = public.app_current_user())) WITH CHECK ((user_id = public.app_current_user()));
--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO supabase_admin;
--
-- Name: FUNCTION api_holdings_accounts(p_date date); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_holdings_accounts(p_date date) TO supabase_admin;
--
-- Name: FUNCTION api_holdings_at(p_date date); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_holdings_at(p_date date) TO supabase_admin;
--
-- Name: FUNCTION api_portfolio_daily(p_from date, p_to date); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.api_portfolio_daily(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_portfolio_daily(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_portfolio_daily(p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_portfolio_daily(p_from date, p_to date) TO supabase_admin;
--
-- Name: FUNCTION api_portfolio_daily_accounts(p_from date, p_to date); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_portfolio_daily_accounts(p_from date, p_to date) TO supabase_admin;
--
-- Name: FUNCTION api_portfolio_monthly(p_from date, p_to date); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_portfolio_monthly(p_from date, p_to date) TO supabase_admin;
--
-- Name: FUNCTION api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_positions_daily_by_account(p_account uuid, p_asset uuid, p_from date, p_to date) TO supabase_admin;
--
-- Name: FUNCTION api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.api_positions_daily_by_asset(p_asset uuid, p_from date, p_to date) TO supabase_admin;
--
-- Name: FUNCTION app_current_user(); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.app_current_user() TO anon;
GRANT ALL ON FUNCTION public.app_current_user() TO authenticated;
GRANT ALL ON FUNCTION public.app_current_user() TO service_role;
GRANT ALL ON FUNCTION public.app_current_user() TO supabase_admin;
--
-- Name: FUNCTION change_user_password(target_user_id uuid, new_plain_password text); Type: ACL; Schema: public; Owner: postgres
--
REVOKE ALL ON FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) TO anon;
GRANT ALL ON FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) TO authenticated;
GRANT ALL ON FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) TO service_role;
GRANT ALL ON FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) TO supabase_admin;
--
-- Name: FUNCTION ensure_daily_positions_partitions(p_from date, p_to date); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) TO supabase_admin;
--
-- Name: FUNCTION fetch_btc_history(); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.fetch_btc_history() TO anon;
GRANT ALL ON FUNCTION public.fetch_btc_history() TO authenticated;
GRANT ALL ON FUNCTION public.fetch_btc_history() TO service_role;
GRANT ALL ON FUNCTION public.fetch_btc_history() TO supabase_admin;
--
-- Name: FUNCTION fetch_price_crypto_history(v_symbol text, v_class text, v_currency text); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO anon;
GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO authenticated;
GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO service_role;
GRANT ALL ON FUNCTION public.fetch_price_crypto_history(v_symbol text, v_class text, v_currency text) TO supabase_admin;
--
-- Name: FUNCTION fn_backfill_user(p_user uuid, p_from date); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.fn_backfill_user(p_user uuid, p_from date) TO anon;
GRANT ALL ON FUNCTION public.fn_backfill_user(p_user uuid, p_from date) TO authenticated;
GRANT ALL ON FUNCTION public.fn_backfill_user(p_user uuid, p_from date) TO service_role;
GRANT ALL ON FUNCTION public.fn_backfill_user(p_user uuid, p_from date) TO supabase_admin;
--
-- Name: FUNCTION fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset uuid, p_from date, p_to date, p_eps numeric); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset uuid, p_from date, p_to date, p_eps numeric) TO supabase_admin;
GRANT ALL ON FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset uuid, p_from date, p_to date, p_eps numeric) TO anon;
GRANT ALL ON FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset uuid, p_from date, p_to date, p_eps numeric) TO authenticated;
GRANT ALL ON FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset uuid, p_from date, p_to date, p_eps numeric) TO service_role;
--
-- Name: FUNCTION fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO supabase_admin;
GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO anon;
GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO authenticated;
GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO service_role;
--
-- Name: FUNCTION get_holdings_secure(); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.get_holdings_secure() TO anon;
GRANT ALL ON FUNCTION public.get_holdings_secure() TO authenticated;
GRANT ALL ON FUNCTION public.get_holdings_secure() TO service_role;
GRANT ALL ON FUNCTION public.get_holdings_secure() TO supabase_admin;
--
-- Name: FUNCTION get_portfolio_value_daily_secure(); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.get_portfolio_value_daily_secure() TO anon;
GRANT ALL ON FUNCTION public.get_portfolio_value_daily_secure() TO authenticated;
GRANT ALL ON FUNCTION public.get_portfolio_value_daily_secure() TO service_role;
GRANT ALL ON FUNCTION public.get_portfolio_value_daily_secure() TO supabase_admin;
--
-- Name: FUNCTION refresh_mv(_name text); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.refresh_mv(_name text) TO anon;
GRANT ALL ON FUNCTION public.refresh_mv(_name text) TO authenticated;
GRANT ALL ON FUNCTION public.refresh_mv(_name text) TO service_role;
GRANT ALL ON FUNCTION public.refresh_mv(_name text) TO supabase_admin;
--
-- Name: FUNCTION trg_events_recalc_acct(); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.trg_events_recalc_acct() TO anon;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct() TO authenticated;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct() TO service_role;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct() TO supabase_admin;
--
-- Name: FUNCTION trg_events_recalc_acct_del(); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO supabase_admin;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO anon;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO authenticated;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO service_role;
--
-- Name: FUNCTION trg_events_recalc_acct_ins(); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_ins() TO supabase_admin;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_ins() TO anon;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_ins() TO authenticated;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_ins() TO service_role;
--
-- Name: FUNCTION trg_events_recalc_acct_upd(); Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_upd() TO supabase_admin;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_upd() TO anon;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_upd() TO authenticated;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_upd() TO service_role;
--
-- Name: TABLE accounts; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.accounts TO anon;
GRANT ALL ON TABLE public.accounts TO authenticated;
GRANT ALL ON TABLE public.accounts TO service_role;
GRANT ALL ON TABLE public.accounts TO supabase_admin;
--
-- Name: TABLE custom_account_valuations; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.custom_account_valuations TO anon;
GRANT ALL ON TABLE public.custom_account_valuations TO authenticated;
GRANT ALL ON TABLE public.custom_account_valuations TO service_role;
GRANT ALL ON TABLE public.custom_account_valuations TO supabase_admin;
--
-- Name: TABLE custom_asset_valuations; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.custom_asset_valuations TO anon;
GRANT ALL ON TABLE public.custom_asset_valuations TO authenticated;
GRANT ALL ON TABLE public.custom_asset_valuations TO service_role;
GRANT ALL ON TABLE public.custom_asset_valuations TO supabase_admin;
--
-- Name: TABLE custom_assets; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.custom_assets TO anon;
GRANT ALL ON TABLE public.custom_assets TO authenticated;
GRANT ALL ON TABLE public.custom_assets TO service_role;
GRANT ALL ON TABLE public.custom_assets TO supabase_admin;
--
-- Name: TABLE daily_positions_acct; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct TO anon;
GRANT ALL ON TABLE public.daily_positions_acct TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2010_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2010_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2010_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2010_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2010_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2011_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2011_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2011_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2011_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2011_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2012_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2012_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2012_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2012_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2012_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2013_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2013_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2013_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2013_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2013_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2014_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2014_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2014_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2014_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2014_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2015_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2015_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2015_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2015_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2015_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2016_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2016_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2016_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2016_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2016_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2017_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2017_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2017_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2017_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2017_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2018_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2018_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2018_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2018_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2018_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2019_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2019_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2019_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2019_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2019_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2020_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2020_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2020_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2020_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2020_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2021_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2021_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2021_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2021_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2021_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2022_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2022_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2022_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2022_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2022_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2023_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2023_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2023_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2023_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2023_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2024_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2024_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2024_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2024_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2024_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_08 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_09; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_09 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_09 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_09 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_09 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_10; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_10 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_10 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_10 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_10 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_11; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_11 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_11 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_11 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_11 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2025_12; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2025_12 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2025_12 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2025_12 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2025_12 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2026_01; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2026_01 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2026_01 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2026_01 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2026_01 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2026_02; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2026_02 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2026_02 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2026_02 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2026_02 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2026_03; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2026_03 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2026_03 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2026_03 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2026_03 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2026_04; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2026_04 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2026_04 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2026_04 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2026_04 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2026_05; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2026_05 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2026_05 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2026_05 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2026_05 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2026_06; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2026_06 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2026_06 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2026_06 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2026_06 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2026_07; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2026_07 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2026_07 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2026_07 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2026_07 TO supabase_admin;
--
-- Name: TABLE daily_positions_acct_2026_08; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.daily_positions_acct_2026_08 TO anon;
GRANT ALL ON TABLE public.daily_positions_acct_2026_08 TO authenticated;
GRANT ALL ON TABLE public.daily_positions_acct_2026_08 TO service_role;
GRANT ALL ON TABLE public.daily_positions_acct_2026_08 TO supabase_admin;
--
-- Name: TABLE dim_calendar; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.dim_calendar TO anon;
GRANT ALL ON TABLE public.dim_calendar TO authenticated;
GRANT ALL ON TABLE public.dim_calendar TO service_role;
GRANT ALL ON TABLE public.dim_calendar TO supabase_admin;
--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;
GRANT ALL ON TABLE public.events TO supabase_admin;
--
-- Name: TABLE external_items; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.external_items TO anon;
GRANT ALL ON TABLE public.external_items TO authenticated;
GRANT ALL ON TABLE public.external_items TO service_role;
GRANT ALL ON TABLE public.external_items TO supabase_admin;
--
-- Name: TABLE global_assets; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.global_assets TO anon;
GRANT ALL ON TABLE public.global_assets TO authenticated;
GRANT ALL ON TABLE public.global_assets TO service_role;
GRANT ALL ON TABLE public.global_assets TO supabase_admin;
--
-- Name: TABLE global_price_daily; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.global_price_daily TO anon;
GRANT ALL ON TABLE public.global_price_daily TO authenticated;
GRANT ALL ON TABLE public.global_price_daily TO service_role;
GRANT ALL ON TABLE public.global_price_daily TO supabase_admin;
--
-- Name: TABLE global_price_daily_filled; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.global_price_daily_filled TO service_role;
GRANT ALL ON TABLE public.global_price_daily_filled TO supabase_admin;
--
-- Name: TABLE user_profiles; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.user_profiles TO anon;
GRANT ALL ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;
GRANT ALL ON TABLE public.user_profiles TO supabase_admin;
--
-- Name: TABLE portfolio_value_daily_detailed; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.portfolio_value_daily_detailed TO supabase_admin;
GRANT ALL ON TABLE public.portfolio_value_daily_detailed TO anon;
GRANT ALL ON TABLE public.portfolio_value_daily_detailed TO authenticated;
GRANT ALL ON TABLE public.portfolio_value_daily_detailed TO service_role;
--
-- Name: TABLE portfolio_value_daily; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.portfolio_value_daily TO supabase_admin;
GRANT ALL ON TABLE public.portfolio_value_daily TO anon;
GRANT ALL ON TABLE public.portfolio_value_daily TO authenticated;
GRANT ALL ON TABLE public.portfolio_value_daily TO service_role;
--
-- Name: TABLE portfolio_value_daily_acct; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.portfolio_value_daily_acct TO supabase_admin;
GRANT ALL ON TABLE public.portfolio_value_daily_acct TO anon;
GRANT ALL ON TABLE public.portfolio_value_daily_acct TO authenticated;
GRANT ALL ON TABLE public.portfolio_value_daily_acct TO service_role;
--
-- Name: TABLE portfolio_value_monthly; Type: ACL; Schema: public; Owner: postgres
--
GRANT ALL ON TABLE public.portfolio_value_monthly TO supabase_admin;
GRANT ALL ON TABLE public.portfolio_value_monthly TO anon;
GRANT ALL ON TABLE public.portfolio_value_monthly TO authenticated;
GRANT ALL ON TABLE public.portfolio_value_monthly TO service_role;
--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO supabase_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO supabase_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;
--
-- PostgreSQL database dump complete
--
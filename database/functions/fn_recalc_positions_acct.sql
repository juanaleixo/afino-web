-- Function: fn_recalc_positions_acct(uuid, uuid, uuid, date)
-- Description: Recalculates the daily positions for a given account and asset from a given date.

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

GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO supabase_admin;
GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO anon;
GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO authenticated;
GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO service_role;

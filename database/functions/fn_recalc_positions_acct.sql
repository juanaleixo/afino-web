-- Function: fn_recalc_positions_acct(uuid, uuid, uuid, date)
-- Description: Recalculates the daily positions for a given account and asset from a given date.

CREATE OR REPLACE FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
v_from date;
v_to date := CURRENT_DATE;
v_curr text;
v_asset_class text;
v_manual_price numeric(20,10);
v_base_units numeric(38,18) := 0;
BEGIN
IF p_user IS NULL OR p_asset IS NULL OR p_account IS NULL OR p_from IS NULL THEN
RAISE EXCEPTION 'fn_recalc_positions_acct: argumentos inválidos';
END IF;
-- Aumenta limite de tempo localmente para evitar cancelamentos em janelas maiores
SET LOCAL statement_timeout = '30s';
-- Evitar gatilhos de agregação por linha durante o bulk
PERFORM set_config('afino.skip_agg', '1', true);
-- serialização por (user,account,asset)
PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_account::text||':'||p_asset::text, 0));
-- menor data afetada: recomputar apenas a partir de p_from
v_from := p_from;
-- garantir partições no range
PERFORM ensure_daily_positions_partitions(v_from, v_to);
-- info do ativo (apenas currency para gravar)
SELECT ga.currency, ga.class, ga.manual_price
INTO v_curr, v_asset_class, v_manual_price
FROM public.global_assets ga
WHERE ga.id = p_asset;
IF v_curr IS NULL THEN
RAISE EXCEPTION 'Ativo % não encontrado em global_assets', p_asset;
END IF;
-- limpa janela e reconstroi
DELETE FROM public.daily_positions_acct
WHERE user_id=p_user AND account_id=p_account AND asset_id=p_asset
AND date BETWEEN v_from AND v_to;
-- unidades acumuladas até a véspera de v_from (baseline)
SELECT COALESCE(SUM(e.units_delta),0)::numeric(38,18)
INTO v_base_units
FROM public.events e
WHERE e.user_id=p_user AND e.account_id=p_account AND e.asset_id=p_asset
AND (e.tstamp)::date < v_from;
WITH cal AS (
SELECT gs::date AS date
FROM generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') AS gs
),
ev AS (
SELECT (e.tstamp)::date AS date, SUM(e.units_delta)::numeric(38,18) AS delta
FROM public.events e
WHERE e.user_id=p_user AND e.account_id=p_account AND e.asset_id=p_asset
  AND (e.tstamp)::date BETWEEN v_from AND v_to
GROUP BY 1
),
steps AS (
SELECT c.date, COALESCE(ev.delta,0)::numeric(38,18) AS daily_change
FROM cal c LEFT JOIN ev ON ev.date=c.date
),
cum AS (
SELECT s.date, (v_base_units + SUM(s.daily_change) OVER (ORDER BY s.date)) AS units
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
  p_user,
  p_account,
  p_asset,
  c.date,
  COALESCE(cu.units,0)::numeric(38,18) AS units,
  CASE
    WHEN cav.value IS NOT NULL THEN NULL
    WHEN v_asset_class = 'currency' THEN 1::numeric(20,10)
    ELSE COALESCE(pr.price, v_manual_price)
  END AS price,
  CASE
    WHEN cav.value IS NOT NULL THEN cav.value
    ELSE COALESCE(cu.units,0)
         * CASE WHEN v_asset_class = 'currency'
                THEN 1::numeric(20,10)
                ELSE COALESCE(pr.price, v_manual_price, 0::numeric(20,10))
           END
  END AS value,
  v_curr AS currency,
  CASE
    WHEN cav.value IS NOT NULL THEN 'custom'
    WHEN v_asset_class = 'currency' THEN 'global'
    WHEN pr.price IS NOT NULL THEN 'global'
    ELSE 'manual'
  END AS source_price,
  true AS is_final
FROM cal c
LEFT JOIN cum cu ON cu.date=c.date
LEFT JOIN price pr ON pr.date=c.date
LEFT JOIN cav ON cav.date=c.date;

-- Ajusta bordas de zeros após reconstrução
PERFORM public.fn_dpa_keep_zero_borders(p_user, p_account, p_asset, v_from, v_to);

-- Atualiza agregações em lote (sem depender dos gatilhos por linha)

-- 1) Detalhado por ativo (user, asset, date)
INSERT INTO public.portfolio_value_daily_detailed (user_id, asset_id, date, asset_value)
SELECT p_user, p_asset, d.date, COALESCE(SUM(d.value),0)
FROM public.daily_positions_acct d
WHERE d.user_id=p_user AND d.asset_id=p_asset AND d.date BETWEEN v_from AND v_to
GROUP BY 1,2,3
ON CONFLICT (user_id, asset_id, date)
DO UPDATE SET asset_value = EXCLUDED.asset_value;
-- remove buracos (se não houver base)
DELETE FROM public.portfolio_value_daily_detailed t
WHERE t.user_id=p_user AND t.asset_id=p_asset AND t.date BETWEEN v_from AND v_to
AND NOT EXISTS (
  SELECT 1 FROM public.daily_positions_acct d
  WHERE d.user_id=p_user AND d.asset_id=p_asset AND d.date=t.date
);

-- 2) Por conta (user, account, date)
INSERT INTO public.portfolio_value_daily_acct (user_id, account_id, date, total_value)
SELECT p_user, p_account, d.date, COALESCE(SUM(d.value),0)
FROM public.daily_positions_acct d
WHERE d.user_id=p_user AND d.account_id=p_account AND d.date BETWEEN v_from AND v_to
GROUP BY 1,2,3
ON CONFLICT (user_id, account_id, date)
DO UPDATE SET total_value = EXCLUDED.total_value;
DELETE FROM public.portfolio_value_daily_acct t
WHERE t.user_id=p_user AND t.account_id=p_account AND t.date BETWEEN v_from AND v_to
AND NOT EXISTS (
  SELECT 1 FROM public.daily_positions_acct d
  WHERE d.user_id=p_user AND d.account_id=p_account AND d.date=t.date
);

-- 3) Diário por usuário (user, date)
INSERT INTO public.portfolio_value_daily (user_id, date, total_value)
SELECT p_user, d.date, COALESCE(SUM(d.value),0)
FROM public.daily_positions_acct d
WHERE d.user_id=p_user AND d.date BETWEEN v_from AND v_to
GROUP BY 1,2
ON CONFLICT (user_id, date)
DO UPDATE SET total_value = EXCLUDED.total_value;
DELETE FROM public.portfolio_value_daily t
WHERE t.user_id=p_user AND t.date BETWEEN v_from AND v_to
AND NOT EXISTS (
  SELECT 1 FROM public.daily_positions_acct d
  WHERE d.user_id=p_user AND d.date=t.date
);

-- 4) Mensal por usuário (user, month) - valor do último dia disponível do mês
WITH months AS (
  SELECT generate_series(date_trunc('month', v_from::timestamp)::date,
                         date_trunc('month', v_to::timestamp)::date,
                         interval '1 month')::date AS month
), last_dates AS (
  SELECT m.month,
         (
           SELECT MAX(d.date)
           FROM public.portfolio_value_daily d
           WHERE d.user_id = p_user
             AND d.date >= m.month AND d.date < (m.month + interval '1 month')::date
         ) AS last_date
  FROM months m
)
INSERT INTO public.portfolio_value_monthly (user_id, month, month_value)
SELECT p_user, ld.month, COALESCE(d.total_value, 0)
FROM last_dates ld
LEFT JOIN public.portfolio_value_daily d
  ON d.user_id = p_user AND d.date = ld.last_date
ON CONFLICT (user_id, month)
DO UPDATE SET month_value = EXCLUDED.month_value;
-- remove meses sem dados
DELETE FROM public.portfolio_value_monthly t
WHERE t.user_id=p_user
  AND t.month BETWEEN date_trunc('month', v_from::timestamp)::date AND date_trunc('month', v_to::timestamp)::date
  AND NOT EXISTS (
    SELECT 1 FROM public.portfolio_value_daily d
    WHERE d.user_id=p_user AND d.date >= t.month AND d.date < (t.month + interval '1 month')::date
  );

END$$;

ALTER FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO supabase_admin;
GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO anon;
GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO authenticated;
GRANT ALL ON FUNCTION public.fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset uuid, p_from date) TO service_role;

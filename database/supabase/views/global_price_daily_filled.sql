-- View: global_price_daily_filled
-- Description: Fills the gaps in the daily prices of global assets.

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

CREATE UNIQUE INDEX idx_gpdf_asset_date ON public.global_price_daily_filled USING btree (asset_id, date);

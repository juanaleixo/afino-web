-- View: portfolio_value_daily
-- Description: Daily portfolio value.

CREATE MATERIALIZED VIEW public.portfolio_value_daily AS
SELECT user_id,
date,
sum(asset_value) AS total_value
FROM public.portfolio_value_daily_detailed
GROUP BY user_id, date
WITH NO DATA;

ALTER MATERIALIZED VIEW public.portfolio_value_daily OWNER TO postgres;

CREATE UNIQUE INDEX ux_pvd_user_date ON public.portfolio_value_daily USING btree (user_id, date);

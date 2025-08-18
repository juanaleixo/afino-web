-- View: portfolio_value_daily_detailed
-- Description: Detailed daily portfolio value for premium users.

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

CREATE UNIQUE INDEX idx_pvdd_user_asset_date ON public.portfolio_value_daily_detailed USING btree (user_id, asset_id, date);

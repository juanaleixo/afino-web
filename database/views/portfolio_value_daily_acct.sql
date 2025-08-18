-- View: portfolio_value_daily_acct
-- Description: Daily portfolio value per account.

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

CREATE UNIQUE INDEX ux_pvda_user_acct_date ON public.portfolio_value_daily_acct USING btree (user_id, account_id, date);

-- View: portfolio_value_monthly
-- Description: Monthly portfolio value.

CREATE MATERIALIZED VIEW public.portfolio_value_monthly AS
SELECT user_id,
(date_trunc('month'::text, (date)::timestamp with time zone))::date AS month,
sum(total_value) AS month_value
FROM public.portfolio_value_daily
GROUP BY user_id, ((date_trunc('month'::text, (date)::timestamp with time zone))::date)
HAVING (abs(sum(total_value)) > 0.000000001)
WITH NO DATA;

ALTER MATERIALIZED VIEW public.portfolio_value_monthly OWNER TO postgres;

CREATE UNIQUE INDEX ux_pvm_user_month ON public.portfolio_value_monthly USING btree (user_id, month);

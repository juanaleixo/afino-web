-- Index: ux_pvd_user_date
-- Description: Unique index on portfolio_value_daily for user and date.

CREATE UNIQUE INDEX ux_pvd_user_date ON public.portfolio_value_daily USING btree (user_id, date);

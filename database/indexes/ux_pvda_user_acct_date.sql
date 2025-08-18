-- Index: ux_pvda_user_acct_date
-- Description: Unique index on portfolio_value_daily_acct for user, account, and date.

CREATE UNIQUE INDEX ux_pvda_user_acct_date ON public.portfolio_value_daily_acct USING btree (user_id, account_id, date);

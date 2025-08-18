-- Index: ux_pvm_user_month
-- Description: Unique index on portfolio_value_monthly for user and month.

CREATE UNIQUE INDEX ux_pvm_user_month ON public.portfolio_value_monthly USING btree (user_id, month);

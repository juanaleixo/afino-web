-- Index: idx_pvdd_user_asset_date
-- Description: Unique index on portfolio_value_daily_detailed for user, asset, and date.

CREATE UNIQUE INDEX idx_pvdd_user_asset_date ON public.portfolio_value_daily_detailed USING btree (user_id, asset_id, date);

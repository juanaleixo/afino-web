-- Index: ux_dpa_user_acct_asset_date
-- Description: Unique index on daily_positions_acct for user, account, asset, and date.

CREATE UNIQUE INDEX ux_dpa_user_acct_asset_date ON ONLY public.daily_positions_acct USING btree (user_id, account_id, asset_id, date);

-- Index: ux_cav_acct_asset_date
-- Description: Unique index on custom_account_valuations for account, asset, and date.

CREATE UNIQUE INDEX ux_cav_acct_asset_date ON public.custom_account_valuations USING btree (account_id, asset_id, date);

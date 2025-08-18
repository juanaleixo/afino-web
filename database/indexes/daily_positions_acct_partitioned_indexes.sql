-- Index: daily_positions_acct_partitioned_indexes
-- Description: Indexes for daily_positions_acct partitions.

-- Example for a specific partition (replace YYYY_MM with actual year and month)
-- CREATE UNIQUE INDEX daily_positions_acct_2010_01_user_id_account_id_asset_id_da_idx ON public.daily_positions_acct_2010_01 USING btree (user_id, account_id, asset_id, date);
-- CREATE INDEX ix_daily_positions_acct_2010_01_user_acct_asset_date ON public.daily_positions_acct_2010_01 USING btree (user_id, account_id, asset_id, date);
-- CREATE INDEX ix_daily_positions_acct_2010_01_user_asset_date ON public.daily_positions_acct_2010_01 USING btree (user_id, asset_id, date);
-- CREATE INDEX ix_daily_positions_acct_2010_01_user_date ON public.daily_positions_acct_2010_01 USING btree (user_id, date);

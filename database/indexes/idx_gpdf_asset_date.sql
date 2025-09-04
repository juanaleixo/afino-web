-- Index: idx_gpdf_asset_date
-- Description: Unique index on global_price_daily_filled for asset and date.

CREATE UNIQUE INDEX idx_gpdf_asset_date ON public.global_price_daily_filled USING btree (asset_symbol, date);

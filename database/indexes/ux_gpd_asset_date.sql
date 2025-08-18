-- Index: ux_gpd_asset_date
-- Description: Unique index on global_price_daily for asset and date.

CREATE UNIQUE INDEX ux_gpd_asset_date ON public.global_price_daily USING btree (asset_id, date);

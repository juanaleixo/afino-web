-- Index: ux_cav_asset_date
-- Description: Unique index on custom_asset_valuations for asset and date.

CREATE UNIQUE INDEX ux_cav_asset_date ON public.custom_asset_valuations USING btree (asset_id, date);

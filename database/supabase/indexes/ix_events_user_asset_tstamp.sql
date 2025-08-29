-- Index: ix_events_user_asset_tstamp
-- Description: Index on events for user, asset, and timestamp.

CREATE INDEX ix_events_user_asset_tstamp ON public.events USING btree (user_id, asset_id, tstamp);

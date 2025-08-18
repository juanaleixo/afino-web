-- Index: ix_events_user_tstamp
-- Description: Index on events for user and timestamp.

CREATE INDEX ix_events_user_tstamp ON public.events USING btree (user_id, tstamp);

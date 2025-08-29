-- Index: ix_events_account_tstamp
-- Description: Index on events for account and timestamp.

CREATE INDEX ix_events_account_tstamp ON public.events USING btree (account_id, tstamp);

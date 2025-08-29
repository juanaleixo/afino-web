-- Trigger: t_events_recalc_acct_upd
-- Description: Trigger on events table to recalculate daily positions after an update operation.

CREATE TRIGGER t_events_recalc_acct_upd AFTER UPDATE ON public.events REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_events_recalc_acct_upd();

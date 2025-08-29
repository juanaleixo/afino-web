-- Trigger: t_events_recalc_acct_del
-- Description: Trigger on events table to recalculate daily positions after a delete operation.

CREATE TRIGGER t_events_recalc_acct_del AFTER DELETE ON public.events REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_events_recalc_acct_del();

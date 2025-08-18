-- Trigger: t_events_recalc_acct_ins
-- Description: Trigger on events table to recalculate daily positions after an insert operation.

CREATE TRIGGER t_events_recalc_acct_ins AFTER INSERT ON public.events REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_events_recalc_acct_ins();

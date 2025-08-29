-- Trigger: validate event kind vs asset class

CREATE TRIGGER t_events_validate_kind_asset
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.trg_events_validate_kind_asset();


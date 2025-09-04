-- Trigger: t_events_create_custom_valuations
-- Description: Automatically create custom asset valuations after inserting events

CREATE TRIGGER t_events_create_custom_valuations
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.trg_events_create_custom_valuations();
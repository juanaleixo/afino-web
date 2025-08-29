-- Trigger: t_events_validate_data
-- Description: Trigger to validate event data before insert/update

CREATE OR REPLACE TRIGGER t_events_validate_data
    BEFORE INSERT OR UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION validate_event_data();

COMMENT ON TRIGGER t_events_validate_data ON public.events IS 'Validates event data consistency including position_add event type';
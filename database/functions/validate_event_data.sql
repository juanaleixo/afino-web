-- Function: validate_event_data
-- Description: Validates event data before insert/update to ensure business logic consistency

CREATE OR REPLACE FUNCTION validate_event_data()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validate position_add events
    IF NEW.kind = 'position_add' THEN
        IF NEW.units_delta IS NULL OR NEW.price_close IS NULL THEN
            RAISE EXCEPTION 'position_add events require units_delta and price_close';
        END IF;
        IF NEW.units_delta <= 0 THEN
            RAISE EXCEPTION 'position_add events require positive units_delta';
        END IF;
    END IF;
    
    -- Validate buy events
    IF NEW.kind = 'buy' THEN
        IF NEW.units_delta IS NULL OR NEW.price_close IS NULL THEN
            RAISE EXCEPTION 'buy events require units_delta and price_close';
        END IF;
        IF NEW.units_delta <= 0 THEN
            RAISE EXCEPTION 'buy events require positive units_delta';
        END IF;
    END IF;
    
    -- Validate deposit events
    IF NEW.kind = 'deposit' THEN
        IF NEW.units_delta IS NULL THEN
            RAISE EXCEPTION 'deposit events require units_delta';
        END IF;
        IF NEW.units_delta <= 0 THEN
            RAISE EXCEPTION 'deposit events require positive units_delta';
        END IF;
    END IF;
    
    -- Validate withdraw events  
    IF NEW.kind = 'withdraw' THEN
        IF NEW.units_delta IS NULL THEN
            RAISE EXCEPTION 'withdraw events require units_delta';
        END IF;
        IF NEW.units_delta >= 0 THEN
            RAISE EXCEPTION 'withdraw events require negative units_delta';
        END IF;
    END IF;
    
    -- Validate valuation events
    IF NEW.kind = 'valuation' THEN
        IF NEW.price_override IS NULL THEN
            RAISE EXCEPTION 'valuation events require price_override';
        END IF;
        IF NEW.price_override <= 0 THEN
            RAISE EXCEPTION 'valuation events require positive price_override';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_event_data() IS 'Validates event data consistency for all event types including position_add';
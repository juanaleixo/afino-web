-- Recreate functions and triggers after cleanup
-- Run this AFTER running drop_removed_tables.sql

-- Recreate the correct update_user_premium_status function
-- LOGIC: Active/trialing subscription = create/update profile, inactive = delete profile
CREATE OR REPLACE FUNCTION update_user_premium_status()
RETURNS trigger AS $$
BEGIN
    -- Handle INSERT/UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- If subscription is active or trialing, ensure user has profile
        IF NEW.status IN ('active', 'trialing') THEN
            INSERT INTO public.user_profiles (
                user_id,
                premium_expires_at,
                stripe_customer_id,
                stripe_subscription_id,
                subscription_status,
                updated_at
            )
            VALUES (
                NEW.user_id,
                NEW.current_period_end::timestamp with time zone,
                NEW.stripe_customer_id,
                NEW.stripe_subscription_id,
                NEW.status,
                now()
            )
            ON CONFLICT (user_id) 
            DO UPDATE SET
                premium_expires_at = NEW.current_period_end::timestamp with time zone,
                stripe_customer_id = NEW.stripe_customer_id,
                stripe_subscription_id = NEW.stripe_subscription_id,
                subscription_status = NEW.status,
                updated_at = now();
        ELSE
            -- If subscription is not active, remove the profile (user becomes free)
            DELETE FROM public.user_profiles 
            WHERE user_id = NEW.user_id;
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- Handle deletion - remove profile (user becomes free)
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.user_profiles 
        WHERE user_id = OLD.user_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the correct is_user_premium function
-- LOGIC: User is premium if profile exists and hasn't expired
CREATE OR REPLACE FUNCTION is_user_premium(user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = $1 
        AND subscription_status IN ('active', 'trialing')
        AND (premium_expires_at IS NULL OR premium_expires_at > now())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_user_premium_status ON pay.subscriptions;
CREATE TRIGGER trigger_update_user_premium_status
    AFTER INSERT OR UPDATE OR DELETE ON pay.subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_user_premium_status();

-- Output confirmation
SELECT 'Functions and triggers recreated successfully' as status;
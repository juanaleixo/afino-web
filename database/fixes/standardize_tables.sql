-- Standardize table structures and fix inconsistencies

-- Fix ACCOUNTS table structure
-- Remove inconsistent DEFAULT auth.uid() and make it explicit NOT NULL
ALTER TABLE public.accounts ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE public.accounts ALTER COLUMN user_id SET NOT NULL;

-- Add missing primary key to WAITLIST table

-- Add unique constraint for email in WAITLIST
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_email_unique UNIQUE (email);

-- Add foreign key constraints to portfolio value tables for data integrity
ALTER TABLE public.portfolio_value_daily 
ADD CONSTRAINT portfolio_value_daily_user_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.portfolio_value_monthly 
ADD CONSTRAINT portfolio_value_monthly_user_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add missing updated_at trigger for consistency
-- First create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to tables that have updated_at but no trigger
DO $$
BEGIN
    -- Add trigger to user_profiles if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_user_profiles_updated_at'
    ) THEN
        CREATE TRIGGER update_user_profiles_updated_at 
        BEFORE UPDATE ON public.user_profiles 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Add trigger to waitlist if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_waitlist_updated_at'
    ) THEN
        CREATE TRIGGER update_waitlist_updated_at 
        BEFORE UPDATE ON public.waitlist 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

SELECT 'Table structures standardized successfully' as status;
-- Add missing RLS policies and grants for security

-- GLOBAL_ASSETS - Public read access (these are reference data)
ALTER TABLE public.global_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to global assets" 
ON public.global_assets FOR SELECT 
USING (true);

GRANT SELECT ON public.global_assets TO authenticated, anon;

-- GLOBAL_PRICE_DAILY - Public read access (market data)
ALTER TABLE public.global_price_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to global prices" 
ON public.global_price_daily FOR SELECT 
USING (true);

GRANT SELECT ON public.global_price_daily TO authenticated, anon;

-- PORTFOLIO_VALUE_DAILY - User-specific access
ALTER TABLE public.portfolio_value_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own portfolio daily values" 
ON public.portfolio_value_daily FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to portfolio daily values" 
ON public.portfolio_value_daily FOR ALL 
USING (auth.role() = 'service_role');

GRANT SELECT ON public.portfolio_value_daily TO authenticated;
GRANT ALL ON public.portfolio_value_daily TO service_role;

-- PORTFOLIO_VALUE_MONTHLY - User-specific access  
ALTER TABLE public.portfolio_value_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own portfolio monthly values" 
ON public.portfolio_value_monthly FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to portfolio monthly values" 
ON public.portfolio_value_monthly FOR ALL 
USING (auth.role() = 'service_role');

GRANT SELECT ON public.portfolio_value_monthly TO authenticated;
GRANT ALL ON public.portfolio_value_monthly TO service_role;

-- WAITLIST - Public insert, service role full access
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert to waitlist" 
ON public.waitlist FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role full access to waitlist" 
ON public.waitlist FOR ALL 
USING (auth.role() = 'service_role');

GRANT INSERT ON public.waitlist TO anon, authenticated;
GRANT ALL ON public.waitlist TO service_role;

-- Fix any missing user_profiles RLS (should already exist but ensure it's complete)
-- Ensure user_profiles RLS exists and is correct
DO $$
BEGIN
    -- Drop and recreate user_profiles policies to ensure they're correct
    DROP POLICY IF EXISTS "Users can manage own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Service role full access" ON public.user_profiles;
    
    CREATE POLICY "Users can manage own profile" ON public.user_profiles
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Service role full access" ON public.user_profiles
    FOR ALL USING (auth.role() = 'service_role');
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

SELECT 'Missing RLS policies and grants added successfully' as status;
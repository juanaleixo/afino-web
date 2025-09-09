-- RLS: user_profiles
-- LOGIC: Users can only access their own premium profile data

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage their own profile
CREATE POLICY "Users can manage own profile" ON public.user_profiles 
    FOR ALL TO authenticated 
    USING (user_id = auth.uid()) 
    WITH CHECK (user_id = auth.uid());

-- Service role has full access (needed for Stripe webhooks)
CREATE POLICY "Service role full access" ON public.user_profiles 
    FOR ALL TO service_role 
    USING (true) 
    WITH CHECK (true);

-- RLS: user_profiles
-- LOGIC: Users can only access their own premium profile data

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- SECURITY: Users can only read their profile and update non-critical fields
CREATE POLICY "Users can view own profile" ON public.user_profiles 
    FOR SELECT TO authenticated 
    USING (user_id = auth.uid());

-- SECURITY: Restricted service role access for Stripe webhooks only
-- Separate policies for different operations to follow principle of least privilege

-- Service role can INSERT new profiles (webhook subscription.created)
CREATE POLICY "Service role webhook insert" ON public.user_profiles 
    FOR INSERT TO service_role 
    WITH CHECK (
        stripe_customer_id IS NOT NULL 
        AND stripe_subscription_id IS NOT NULL
        AND subscription_status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid')
    );

-- Service role can UPDATE existing profiles (webhook subscription.updated)
CREATE POLICY "Service role webhook update" ON public.user_profiles 
    FOR UPDATE TO service_role 
    USING (true)
    WITH CHECK (
        stripe_customer_id IS NOT NULL 
        AND stripe_subscription_id IS NOT NULL
        AND subscription_status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid')
    );

-- Service role can SELECT for webhook validation and user lookup
CREATE POLICY "Service role read access" ON public.user_profiles 
    FOR SELECT TO service_role 
    USING (true);

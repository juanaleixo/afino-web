-- Table: user_profiles  
-- Description: Stores ONLY premium user information. Existence of record = premium user.
-- Free users exist only in auth.users without any profile record.
-- LOGIC: No profile = Free user, Has profile = Premium user

CREATE TABLE public.user_profiles (
    user_id uuid NOT NULL,
    email text,
    full_name text,
    avatar_url text,
    
    -- Premium subscription details
    premium_expires_at timestamp with time zone, -- NULL = never expires
    
    -- Stripe integration
    stripe_customer_id text UNIQUE NOT NULL,
    stripe_subscription_id text UNIQUE NOT NULL,
    subscription_status text NOT NULL CHECK (subscription_status IN (
        'active', 'canceled', 'incomplete', 'incomplete_expired', 
        'past_due', 'trialing', 'unpaid'
    )),
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.user_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_profiles OWNER TO postgres;

ALTER TABLE ONLY public.user_profiles
ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id ON public.user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_subscription_id ON public.user_profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_status ON public.user_profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_expires_at ON public.user_profiles(premium_expires_at) WHERE premium_expires_at IS NOT NULL;

-- Foreign key constraints
ALTER TABLE ONLY public.user_profiles
ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

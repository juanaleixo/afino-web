-- Table: pay.subscriptions
-- Description: Stores user subscription information from Stripe

CREATE TABLE pay.subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_subscription_id text UNIQUE,
    stripe_customer_id text,
    stripe_price_id text,
    stripe_product_id text,
    status text NOT NULL CHECK (status IN (
        'active', 
        'canceled', 
        'incomplete', 
        'incomplete_expired', 
        'past_due', 
        'trialing', 
        'unpaid'
    )),
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false,
    canceled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add RLS
ALTER TABLE pay.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own subscriptions" ON pay.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions" ON pay.subscriptions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can insert own subscriptions" ON pay.subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own subscriptions" ON pay.subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_subscriptions_user_id ON pay.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON pay.subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_user_status ON pay.subscriptions(user_id, status);
CREATE INDEX idx_subscriptions_status_period ON pay.subscriptions(status, current_period_end);

-- Grant permissions
GRANT ALL ON pay.subscriptions TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON pay.subscriptions TO authenticated;
GRANT USAGE ON SCHEMA pay TO postgres, service_role, authenticated, anon;
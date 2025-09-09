-- Table: pay.webhook_events
-- Description: Stores Stripe webhook events for idempotency and debugging

CREATE TABLE pay.webhook_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_event_id text NOT NULL UNIQUE,
    event_type text NOT NULL,
    processed boolean DEFAULT false,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    data jsonb
);

-- Add RLS
ALTER TABLE pay.webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies (only service role should access webhooks)
CREATE POLICY "Service role can manage webhook events" ON pay.webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_webhook_events_stripe_event_id ON pay.webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_processed ON pay.webhook_events(processed);
CREATE INDEX idx_webhook_events_event_type ON pay.webhook_events(event_type);
CREATE INDEX idx_webhook_events_created_at ON pay.webhook_events(created_at);

-- Grant permissions
GRANT ALL ON pay.webhook_events TO postgres, service_role;
GRANT USAGE ON SCHEMA pay TO postgres, service_role, authenticated, anon;
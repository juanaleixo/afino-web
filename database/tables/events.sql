-- Table: events
-- Description: Stores all events and transactions.

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    account_id uuid, -- Made optional to match application usage
    tstamp timestamp with time zone NOT NULL,
    kind text NOT NULL,
    units_delta numeric,
    price_override numeric,
    price_close numeric,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    -- Updated business logic constraint to handle all event types properly
    CONSTRAINT events_business_logic_check CHECK (
        -- All events except valuation must have units_delta
        (kind != 'valuation' AND units_delta IS NOT NULL) OR (kind = 'valuation')
        AND
        -- Buy and position_add require price_close
        ((kind IN ('buy', 'position_add') AND price_close IS NOT NULL) OR kind NOT IN ('buy', 'position_add'))
        AND
        -- Valuation must have price_override
        ((kind = 'valuation' AND price_override IS NOT NULL) OR kind != 'valuation')
        AND
        -- Allow price_override for deposit/withdraw (for non-currency assets) and valuation
        (price_override IS NULL OR kind IN ('deposit', 'withdraw', 'valuation'))
    ),
    -- Updated to match application event types
    CONSTRAINT events_kind_check CHECK ((kind = ANY (ARRAY['deposit'::text, 'withdraw'::text, 'buy'::text, 'position_add'::text, 'valuation'::text])))
);

ALTER TABLE ONLY public.events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.events OWNER TO postgres;

ALTER TABLE ONLY public.events
ADD CONSTRAINT events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.events
ADD CONSTRAINT events_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);

ALTER TABLE ONLY public.events
ADD CONSTRAINT events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.global_assets(id);

ALTER TABLE ONLY public.events
ADD CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

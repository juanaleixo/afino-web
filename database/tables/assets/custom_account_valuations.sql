-- Table: custom_account_valuations
-- Description: Stores custom valuations for specific assets in specific accounts on specific dates.

CREATE TABLE public.custom_account_valuations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    date date NOT NULL,
    value numeric(20,10) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT custom_account_valuations_pkey PRIMARY KEY (id),
    CONSTRAINT custom_account_valuations_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
    CONSTRAINT custom_account_valuations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.custom_assets(id) ON DELETE CASCADE,
    CONSTRAINT custom_account_valuations_account_asset_date_key UNIQUE (account_id, asset_id, date)
);

ALTER TABLE ONLY public.custom_account_valuations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.custom_account_valuations OWNER TO postgres;
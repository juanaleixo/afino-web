-- Table: custom_account_valuations
-- Description: Stores custom valuations for assets in a specific account.

CREATE TABLE public.custom_account_valuations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    date date NOT NULL,
    value numeric(20,10) NOT NULL
);

ALTER TABLE ONLY public.custom_account_valuations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.custom_account_valuations OWNER TO postgres;

ALTER TABLE ONLY public.custom_account_valuations
ADD CONSTRAINT custom_account_valuations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.custom_account_valuations
ADD CONSTRAINT custom_account_valuations_account_id_asset_id_date_key UNIQUE (account_id, asset_id, date);

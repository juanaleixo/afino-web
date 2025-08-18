-- Table: custom_asset_valuations
-- Description: Stores custom valuations for assets.

CREATE TABLE public.custom_asset_valuations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    date date NOT NULL,
    value numeric NOT NULL
);

ALTER TABLE ONLY public.custom_asset_valuations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.custom_asset_valuations OWNER TO postgres;

ALTER TABLE ONLY public.custom_asset_valuations
ADD CONSTRAINT custom_asset_valuations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.custom_asset_valuations
ADD CONSTRAINT custom_asset_valuations_asset_id_date_key UNIQUE (asset_id, date);

ALTER TABLE ONLY public.custom_asset_valuations
ADD CONSTRAINT custom_asset_valuations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.custom_assets(id) ON DELETE CASCADE;

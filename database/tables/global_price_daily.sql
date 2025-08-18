-- Table: global_price_daily
-- Description: Stores the daily price of global assets.

CREATE TABLE public.global_price_daily (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    date date NOT NULL,
    price numeric NOT NULL
);

ALTER TABLE public.global_price_daily OWNER TO postgres;

ALTER TABLE ONLY public.global_price_daily
ADD CONSTRAINT global_price_daily_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.global_price_daily
ADD CONSTRAINT global_price_daily_asset_id_date_key UNIQUE (asset_id, date);

ALTER TABLE ONLY public.global_price_daily
ADD CONSTRAINT global_price_daily_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.global_assets(id) ON DELETE CASCADE;

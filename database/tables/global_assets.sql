-- Table: global_assets
-- Description: Stores global assets information.

CREATE TABLE public.global_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    symbol text NOT NULL,
    class text NOT NULL,
    currency text NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    manual_price numeric,
    label_ptbr text
);

ALTER TABLE public.global_assets OWNER TO postgres;

ALTER TABLE ONLY public.global_assets
ADD CONSTRAINT global_assets_pkey PRIMARY KEY (id);

-- Garantir unicidade case-insensitive de símbolo por classe (evita BTC/btc)
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS ux_global_assets_symbol_ci_class
    ON public.global_assets (lower(symbol), class);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

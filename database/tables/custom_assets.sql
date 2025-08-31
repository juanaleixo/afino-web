-- Table: custom_assets
-- Description: Stores custom assets created by users.

CREATE TABLE public.custom_assets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  label text NOT NULL,
  currency text NOT NULL,
  meta jsonb,
  created_at timestamp with time zone DEFAULT now(),
  class text NULL,
  symbol text NULL,
  CONSTRAINT custom_assets_pkey PRIMARY KEY (id),
  CONSTRAINT custom_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id),
  CONSTRAINT custom_assets_class_check CHECK (
    (
      (class is null)
      OR (
        class = any (
          ARRAY[
            'currency'::text,
            'cash'::text,
            'stock'::text,
            'crypto'::text,
            'fund'::text,
            'commodity'::text,
            'bond'::text,
            'reit'::text,
            'real_estate'::text,
            'vehicle'::text
          ]
        )
      )
    )
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_custom_assets_class ON public.custom_assets USING btree (class) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_custom_assets_symbol ON public.custom_assets USING btree (symbol) TABLESPACE pg_default;
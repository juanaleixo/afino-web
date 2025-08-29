-- Table: custom_assets
-- Description: Stores custom assets created by users.

CREATE TABLE public.custom_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text NOT NULL,
    currency text NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.custom_assets FORCE ROW LEVEL SECURITY;

ALTER TABLE public.custom_assets OWNER TO postgres;

ALTER TABLE ONLY public.custom_assets
ADD CONSTRAINT custom_assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.custom_assets
ADD CONSTRAINT custom_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

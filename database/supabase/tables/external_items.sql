-- Table: external_items
-- Description: Stores external items information.

CREATE TABLE public.external_items (
    id uuid NOT NULL,
    user_id uuid,
    provider text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.external_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.external_items OWNER TO postgres;

ALTER TABLE ONLY public.external_items
ADD CONSTRAINT external_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.external_items
ADD CONSTRAINT external_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

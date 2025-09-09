-- Table: accounts
-- Description: Stores user account information.

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid(),
    label text NOT NULL,
    currency text DEFAULT 'BRL'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.accounts OWNER TO postgres;

ALTER TABLE ONLY public.accounts
ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.accounts
ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Table: user_profiles
-- Description: Stores user profile information.

CREATE TABLE public.user_profiles (
    user_id uuid NOT NULL,
    plan text DEFAULT '''premium''::text'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.user_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_profiles OWNER TO postgres;

ALTER TABLE ONLY public.user_profiles
ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.user_profiles
ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Function: change_user_password(uuid, text)
-- Description: Changes the password for a given user.

CREATE FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
-- Use service role to update auth.users
UPDATE auth.users
SET encrypted_password = crypt(new_plain_password, gen_salt('bf'))
WHERE id = target_user_id;
END;
$$;

ALTER FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) TO anon;
GRANT ALL ON FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) TO authenticated;
GRANT ALL ON FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) TO service_role;
GRANT ALL ON FUNCTION public.change_user_password(target_user_id uuid, new_plain_password text) TO supabase_admin;

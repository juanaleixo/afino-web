-- Function: app_current_user()
-- Description: Returns the current user's ID.

CREATE OR REPLACE FUNCTION public.app_current_user() RETURNS uuid
LANGUAGE plpgsql STABLE
AS $$
DECLARE v uuid;
BEGIN
-- Supabase: tentar auth.uid()
BEGIN
EXECUTE 'SELECT auth.uid()' INTO v;
IF v IS NOT NULL THEN
RETURN v;
END IF;
EXCEPTION WHEN undefined_function THEN
-- ignore se não existir
END;
-- Fallback: variável de sessão app.user_id (defina no backend)
v := NULLIF(current_setting('app.user_id', true), '')::uuid;
RETURN v;
END$$;

ALTER FUNCTION public.app_current_user() OWNER TO postgres;

-- SECURITY: Restricted permissions for user identification function
-- Anonymous users should not access user identification functions
REVOKE ALL ON FUNCTION public.app_current_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_current_user() FROM anon;

-- Grant minimal required permissions
GRANT EXECUTE ON FUNCTION public.app_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_current_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.app_current_user() TO supabase_admin;

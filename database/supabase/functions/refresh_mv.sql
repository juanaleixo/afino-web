-- Function: refresh_mv(text)
-- Description: Refreshes a materialized view.

CREATE FUNCTION public.refresh_mv(_name text) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', _name);
END $$;

ALTER FUNCTION public.refresh_mv(_name text) OWNER TO postgres;

GRANT ALL ON FUNCTION public.refresh_mv(_name text) TO anon;
GRANT ALL ON FUNCTION public.refresh_mv(_name text) TO authenticated;
GRANT ALL ON FUNCTION public.refresh_mv(_name text) TO service_role;
GRANT ALL ON FUNCTION public.refresh_mv(_name text) TO supabase_admin;

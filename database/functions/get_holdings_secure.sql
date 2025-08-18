-- Function: get_holdings_secure()
-- Description: Returns the holdings for the current user.

CREATE FUNCTION public.get_holdings_secure() RETURNS TABLE(user_id uuid, account_id uuid, asset_id uuid, units numeric)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
RETURN QUERY
SELECT h.user_id, h.account_id, h.asset_id, h.units
FROM holdings h
WHERE h.user_id = auth.uid();
END;
$$;

ALTER FUNCTION public.get_holdings_secure() OWNER TO postgres;

GRANT ALL ON FUNCTION public.get_holdings_secure() TO anon;
GRANT ALL ON FUNCTION public.get_holdings_secure() TO authenticated;
GRANT ALL ON FUNCTION public.get_holdings_secure() TO service_role;
GRANT ALL ON FUNCTION public.get_holdings_secure() TO supabase_admin;

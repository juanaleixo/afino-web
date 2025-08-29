-- Function: fn_backfill_user(uuid, date)
-- Description: Backfills the daily positions for a given user from a given date.

CREATE FUNCTION public.fn_backfill_user(p_user uuid, p_from date) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
r RECORD;
v_from date;
BEGIN
IF p_user IS NULL OR p_from IS NULL THEN
RAISE EXCEPTION 'fn_backfill_user: argumentos inválidos';
END IF;
-- Garante partições
PERFORM ensure_daily_positions_partitions(p_from, CURRENT_DATE + INTERVAL '1 month');
FOR r IN
SELECT e.account_id, e.asset_id, MIN((e.tstamp)::date) AS first_date
FROM public.events e
WHERE e.user_id = p_user
GROUP BY e.account_id, e.asset_id
LOOP
v_from := LEAST(COALESCE(r.first_date, p_from), p_from);
PERFORM fn_recalc_positions_acct(p_user, r.account_id, r.asset_id, v_from);
END LOOP;
END$$;

ALTER FUNCTION public.fn_backfill_user(p_user uuid, p_from date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.fn_backfill_user(p_user uuid, p_from date) TO anon;
GRANT ALL ON FUNCTION public.fn_backfill_user(p_user uuid, p_from date) TO authenticated;
GRANT ALL ON FUNCTION public.fn_backfill_user(p_user uuid, p_from date) TO service_role;
GRANT ALL ON FUNCTION public.fn_backfill_user(p_user uuid, p_from date) TO supabase_admin;

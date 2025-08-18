-- Function: trg_events_recalc_acct_del()
-- Description: Trigger function to recalculate the daily positions after deleting an event.

CREATE FUNCTION public.trg_events_recalc_acct_del() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE rec RECORD;
BEGIN
FOR rec IN
SELECT user_id, account_id, asset_id,
MIN((tstamp)::date) AS from_date,
MAX((tstamp)::date) AS to_date
FROM old_rows
WHERE user_id IS NOT NULL AND account_id IS NOT NULL AND asset_id IS NOT NULL
GROUP BY 1,2,3
LOOP
PERFORM public.fn_recalc_positions_acct(rec.user_id, rec.account_id, rec.asset_id, rec.from_date);
PERFORM public.fn_dpa_keep_zero_borders(rec.user_id, rec.account_id, rec.asset_id, rec.from_date, COALESCE(rec.to_date, CURRENT_DATE));
END LOOP;
RETURN NULL;
END$$;

ALTER FUNCTION public.trg_events_recalc_acct_del() OWNER TO postgres;

GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO supabase_admin;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO anon;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO authenticated;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO service_role;

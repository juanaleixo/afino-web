-- Function: trg_events_recalc_acct_ins()
-- Description: Trigger function to recalculate the daily positions after inserting an event.

CREATE OR REPLACE FUNCTION public.trg_events_recalc_acct_ins() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE rec RECORD;
BEGIN
FOR rec IN
SELECT user_id, account_id, asset_symbol,
MIN((tstamp)::date) AS from_date,
MAX((tstamp)::date) AS to_date
FROM new_rows
WHERE user_id IS NOT NULL AND account_id IS NOT NULL AND asset_symbol IS NOT NULL
GROUP BY 1,2,3
LOOP
PERFORM public.fn_recalc_positions_acct(rec.user_id, rec.account_id, rec.asset_symbol, rec.from_date);
END LOOP;
RETURN NULL;
END$$;

ALTER FUNCTION public.trg_events_recalc_acct_ins() OWNER TO postgres;

GRANT ALL ON FUNCTION public.trg_events_recalc_acct_ins() TO supabase_admin;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_ins() TO anon;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_ins() TO authenticated;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_ins() TO service_role;

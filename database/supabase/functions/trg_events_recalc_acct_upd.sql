-- Function: trg_events_recalc_acct_upd()
-- Description: Trigger function to recalculate the daily positions after updating an event.

CREATE OR REPLACE FUNCTION public.trg_events_recalc_acct_upd() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE rec RECORD;
BEGIN
FOR rec IN
WITH rows AS (
SELECT user_id, account_id, asset_id, (tstamp)::date AS d FROM old_rows
UNION ALL
SELECT user_id, account_id, asset_id, (tstamp)::date AS d FROM new_rows
)
SELECT user_id, account_id, asset_id,
MIN(d) AS from_date,
MAX(d) AS to_date
FROM rows
WHERE user_id IS NOT NULL AND account_id IS NOT NULL AND asset_id IS NOT NULL
GROUP BY 1,2,3
LOOP
PERFORM public.fn_recalc_positions_acct(rec.user_id, rec.account_id, rec.asset_id, rec.from_date);
END LOOP;
RETURN NULL;
END$$;

ALTER FUNCTION public.trg_events_recalc_acct_upd() OWNER TO postgres;

GRANT ALL ON FUNCTION public.trg_events_recalc_acct_upd() TO supabase_admin;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_upd() TO anon;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_upd() TO authenticated;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_upd() TO service_role;

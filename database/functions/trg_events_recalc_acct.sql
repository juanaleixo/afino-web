-- Function: trg_events_recalc_acct()
-- Description: Trigger function to recalculate the daily positions after an event.

CREATE FUNCTION public.trg_events_recalc_acct() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
u_old uuid; a_old uuid; acc_old uuid; d_old date;
u_new uuid; a_new uuid; acc_new uuid; d_new date;
BEGIN
IF TG_OP = 'INSERT' THEN
u_new := NEW.user_id; a_new := NEW.asset_id; acc_new := NEW.account_id; d_new := (NEW.tstamp)::date;
IF u_new IS NOT NULL AND a_new IS NOT NULL AND acc_new IS NOT NULL THEN
PERFORM fn_recalc_positions_acct(u_new, acc_new, a_new, COALESCE(d_new, CURRENT_DATE));
END IF;
RETURN NEW;
ELSIF TG_OP = 'UPDATE' THEN
u_old := OLD.user_id; a_old := OLD.asset_id; acc_old := OLD.account_id; d_old := (OLD.tstamp)::date;
u_new := NEW.user_id; a_new := NEW.asset_id; acc_new := NEW.account_id; d_new := (NEW.tstamp)::date;
-- Recalc lado OLD
IF u_old IS NOT NULL AND a_old IS NOT NULL AND acc_old IS NOT NULL THEN
PERFORM fn_recalc_positions_acct(u_old, acc_old, a_old, COALESCE(d_old, d_new, CURRENT_DATE));
END IF;
-- Recalc lado NEW (se mudou algo)
IF (u_new, a_new, acc_new) IS DISTINCT FROM (u_old, a_old, acc_old) OR d_new IS DISTINCT FROM d_old THEN
IF u_new IS NOT NULL AND a_new IS NOT NULL AND acc_new IS NOT NULL THEN
PERFORM fn_recalc_positions_acct(u_new, acc_new, a_new, COALESCE(d_old, d_new, CURRENT_DATE));
END IF;
END IF;
RETURN NEW;
ELSIF TG_OP = 'DELETE' THEN
u_old := OLD.user_id; a_old := OLD.asset_id; acc_old := OLD.account_id; d_old := (OLD.tstamp)::date;
IF u_old IS NOT NULL AND a_old IS NOT NULL AND acc_old IS NOT NULL THEN
PERFORM fn_recalc_positions_acct(u_old, acc_old, a_old, COALESCE(d_old, CURRENT_DATE));
END IF;
RETURN OLD;
END IF;
RETURN NULL;
END$$;

ALTER FUNCTION public.trg_events_recalc_acct() OWNER TO postgres;

GRANT ALL ON FUNCTION public.trg_events_recalc_acct() TO anon;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct() TO authenticated;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct() TO service_role;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct() TO supabase_admin;

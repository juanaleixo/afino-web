-- Function: fn_finalize_portfolio_day(date)
-- Purpose: Finalize daily snapshots for all users at a given date.
-- Notes:
--  - Iterates all (user, account, asset) combos that had activity up to p_date
--    and recomputes positions/value from p_date to CURRENT_DATE using
--    fn_recalc_positions_acct. This guarantees an end-of-day snapshot exists
--    for p_date (and forward-fills until today) even if no event happened.

CREATE OR REPLACE FUNCTION public.fn_finalize_portfolio_day(p_date date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  v_from date := p_date;
  v_to   date := CURRENT_DATE;
BEGIN
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'fn_finalize_portfolio_day: p_date inválido';
  END IF;

  -- Step 1) Update prices first to guarantee valuation order
  BEGIN
    PERFORM public.refresh_all_asset_prices();
    -- Refresh filled MV if present (best-effort)
    PERFORM public.refresh_mv('global_price_daily_filled');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Falha ao atualizar preços ou materialized view: %', SQLERRM;
  END;

  -- Avoid too small ranges if current_date < p_date (defensive)
  IF v_to < v_from THEN
    v_to := v_from;
  END IF;

  -- Ensure partitions for the range
  PERFORM ensure_daily_positions_partitions(v_from, v_to);

  -- Step 2) Recompute in bulk for all user/account/asset combinations that existed up to p_date
  FOR rec IN
    SELECT e.user_id, e.account_id, e.asset_id
    FROM public.events e
    WHERE (e.tstamp)::date <= p_date
      AND e.user_id IS NOT NULL
      AND e.account_id IS NOT NULL
      AND e.asset_id IS NOT NULL
    GROUP BY 1,2,3
  LOOP
    PERFORM public.fn_recalc_positions_acct(rec.user_id, rec.account_id, rec.asset_id, v_from);
  END LOOP;
END;
$$;

ALTER FUNCTION public.fn_finalize_portfolio_day(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.fn_finalize_portfolio_day(p_date date) TO supabase_admin;
GRANT ALL ON FUNCTION public.fn_finalize_portfolio_day(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.fn_finalize_portfolio_day(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.fn_finalize_portfolio_day(p_date date) TO anon;

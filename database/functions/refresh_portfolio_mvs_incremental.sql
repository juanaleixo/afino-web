-- Function: refresh_portfolio_mvs_incremental()
-- Purpose: Keep aggregation tables (portfolio_value_daily_detailed, _daily_acct,
--          _daily, _monthly) consistent with changes in daily_positions_acct.
-- Notes:   Works for INSERT/UPDATE/DELETE as an AFTER ROW trigger. Recomputes
--          only the affected (user, [account], [asset], date) groups and their
--          derived monthly bucket. No REFRESH MATERIALIZED VIEW is used anymore.

CREATE OR REPLACE FUNCTION public.refresh_portfolio_mvs_incremental()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  -- New keys (for INSERT/UPDATE)
  n_user uuid;
  n_account uuid;
  n_asset uuid;
  n_date date;
  n_month date;

  -- Old keys (for UPDATE/DELETE)
  o_user uuid;
  o_account uuid;
  o_asset uuid;
  o_date date;
  o_month date;

  -- Helpers
  month_start date;
  month_end date;
  exists_row boolean;
BEGIN
  -- Helper inlined logic to avoid nested procedures (not supported)
  -- Performs upsert/delete for detailed, daily_acct, daily, and monthly aggregates

  -- Capture new and old keys depending on operation
  IF TG_OP IN ('INSERT','UPDATE') THEN
    n_user := NEW.user_id; n_account := NEW.account_id; n_asset := NEW.asset_id; n_date := NEW.date;
    n_month := (date_trunc('month', NEW.date::timestamp))::date;

    -- detailed
    SELECT EXISTS (
      SELECT 1 FROM public.daily_positions_acct d
      WHERE d.user_id=n_user AND d.asset_id=n_asset AND d.date=n_date
    ) INTO exists_row;
    IF exists_row THEN
      INSERT INTO public.portfolio_value_daily_detailed (user_id, asset_id, date, asset_value)
      SELECT n_user, n_asset, n_date, COALESCE(SUM(d.value),0)
      FROM public.daily_positions_acct d
      WHERE d.user_id=n_user AND d.asset_id=n_asset AND d.date=n_date
      GROUP BY 1,2,3
      ON CONFLICT (user_id, asset_id, date)
      DO UPDATE SET asset_value = EXCLUDED.asset_value;
    ELSE
      DELETE FROM public.portfolio_value_daily_detailed
      WHERE user_id=n_user AND asset_id=n_asset AND date=n_date;
    END IF;

    -- daily_acct
    SELECT EXISTS (
      SELECT 1 FROM public.daily_positions_acct d
      WHERE d.user_id=n_user AND d.account_id=n_account AND d.date=n_date
    ) INTO exists_row;
    IF exists_row THEN
      INSERT INTO public.portfolio_value_daily_acct (user_id, account_id, date, total_value)
      SELECT n_user, n_account, n_date, COALESCE(SUM(d.value),0)
      FROM public.daily_positions_acct d
      WHERE d.user_id=n_user AND d.account_id=n_account AND d.date=n_date
      GROUP BY 1,2,3
      ON CONFLICT (user_id, account_id, date)
      DO UPDATE SET total_value = EXCLUDED.total_value;
    ELSE
      DELETE FROM public.portfolio_value_daily_acct
      WHERE user_id=n_user AND account_id=n_account AND date=n_date;
    END IF;

    -- daily
    SELECT EXISTS (
      SELECT 1 FROM public.daily_positions_acct d
      WHERE d.user_id=n_user AND d.date=n_date
    ) INTO exists_row;
    IF exists_row THEN
      INSERT INTO public.portfolio_value_daily (user_id, date, total_value)
      SELECT n_user, n_date, COALESCE(SUM(d.value),0)
      FROM public.daily_positions_acct d
      WHERE d.user_id=n_user AND d.date=n_date
      GROUP BY 1,2
      ON CONFLICT (user_id, date)
      DO UPDATE SET total_value = EXCLUDED.total_value;
    ELSE
      DELETE FROM public.portfolio_value_daily
      WHERE user_id=n_user AND date=n_date;
    END IF;

    -- monthly
    month_start := n_month;
    month_end   := (n_month + INTERVAL '1 month')::date;
    SELECT EXISTS (
      SELECT 1 FROM public.portfolio_value_daily d
      WHERE d.user_id=n_user AND d.date >= month_start AND d.date < month_end
    ) INTO exists_row;
    IF exists_row THEN
      INSERT INTO public.portfolio_value_monthly (user_id, month, month_value)
      SELECT n_user, month_start, COALESCE(SUM(d.total_value),0)
      FROM public.portfolio_value_daily d
      WHERE d.user_id=n_user AND d.date >= month_start AND d.date < month_end
      GROUP BY 1,2
      ON CONFLICT (user_id, month)
      DO UPDATE SET month_value = EXCLUDED.month_value;
    ELSE
      DELETE FROM public.portfolio_value_monthly
      WHERE user_id=n_user AND month = month_start;
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE','DELETE') THEN
    o_user := OLD.user_id; o_account := OLD.account_id; o_asset := OLD.asset_id; o_date := OLD.date;
    o_month := (date_trunc('month', OLD.date::timestamp))::date;

    -- detailed (old)
    SELECT EXISTS (
      SELECT 1 FROM public.daily_positions_acct d
      WHERE d.user_id=o_user AND d.asset_id=o_asset AND d.date=o_date
    ) INTO exists_row;
    IF exists_row THEN
      INSERT INTO public.portfolio_value_daily_detailed (user_id, asset_id, date, asset_value)
      SELECT o_user, o_asset, o_date, COALESCE(SUM(d.value),0)
      FROM public.daily_positions_acct d
      WHERE d.user_id=o_user AND d.asset_id=o_asset AND d.date=o_date
      GROUP BY 1,2,3
      ON CONFLICT (user_id, asset_id, date)
      DO UPDATE SET asset_value = EXCLUDED.asset_value;
    ELSE
      DELETE FROM public.portfolio_value_daily_detailed
      WHERE user_id=o_user AND asset_id=o_asset AND date=o_date;
    END IF;

    -- daily_acct (old)
    SELECT EXISTS (
      SELECT 1 FROM public.daily_positions_acct d
      WHERE d.user_id=o_user AND d.account_id=o_account AND d.date=o_date
    ) INTO exists_row;
    IF exists_row THEN
      INSERT INTO public.portfolio_value_daily_acct (user_id, account_id, date, total_value)
      SELECT o_user, o_account, o_date, COALESCE(SUM(d.value),0)
      FROM public.daily_positions_acct d
      WHERE d.user_id=o_user AND d.account_id=o_account AND d.date=o_date
      GROUP BY 1,2,3
      ON CONFLICT (user_id, account_id, date)
      DO UPDATE SET total_value = EXCLUDED.total_value;
    ELSE
      DELETE FROM public.portfolio_value_daily_acct
      WHERE user_id=o_user AND account_id=o_account AND date=o_date;
    END IF;

    -- daily (old)
    SELECT EXISTS (
      SELECT 1 FROM public.daily_positions_acct d
      WHERE d.user_id=o_user AND d.date=o_date
    ) INTO exists_row;
    IF exists_row THEN
      INSERT INTO public.portfolio_value_daily (user_id, date, total_value)
      SELECT o_user, o_date, COALESCE(SUM(d.value),0)
      FROM public.daily_positions_acct d
      WHERE d.user_id=o_user AND d.date=o_date
      GROUP BY 1,2
      ON CONFLICT (user_id, date)
      DO UPDATE SET total_value = EXCLUDED.total_value;
    ELSE
      DELETE FROM public.portfolio_value_daily
      WHERE user_id=o_user AND date=o_date;
    END IF;

    -- monthly (old)
    month_start := o_month;
    month_end   := (o_month + INTERVAL '1 month')::date;
    SELECT EXISTS (
      SELECT 1 FROM public.portfolio_value_daily d
      WHERE d.user_id=o_user AND d.date >= month_start AND d.date < month_end
    ) INTO exists_row;
    IF exists_row THEN
      INSERT INTO public.portfolio_value_monthly (user_id, month, month_value)
      SELECT o_user, month_start, COALESCE(SUM(d.total_value),0)
      FROM public.portfolio_value_daily d
      WHERE d.user_id=o_user AND d.date >= month_start AND d.date < month_end
      GROUP BY 1,2
      ON CONFLICT (user_id, month)
      DO UPDATE SET month_value = EXCLUDED.month_value;
    ELSE
      DELETE FROM public.portfolio_value_monthly
      WHERE user_id=o_user AND month = month_start;
    END IF;
  END IF;

  RETURN NULL; -- AFTER triggers return NULL
END;
$$;

ALTER FUNCTION public.refresh_portfolio_mvs_incremental() OWNER TO postgres;

GRANT ALL ON FUNCTION public.refresh_portfolio_mvs_incremental() TO supabase_admin;
GRANT ALL ON FUNCTION public.refresh_portfolio_mvs_incremental() TO anon;
GRANT ALL ON FUNCTION public.refresh_portfolio_mvs_incremental() TO authenticated;
GRANT ALL ON FUNCTION public.refresh_portfolio_mvs_incremental() TO service_role;

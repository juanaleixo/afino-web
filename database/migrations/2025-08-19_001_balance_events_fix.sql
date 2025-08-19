-- Migration: Balance by events — schema alignment and performance
-- Safe to run multiple times. Requires privileges to manage schema.

BEGIN;

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Drop conflicting objects (MV or TABLE), whichever exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='portfolio_value_daily_detailed' AND c.relkind='m'
  ) THEN
    EXECUTE 'DROP MATERIALIZED VIEW public.portfolio_value_daily_detailed CASCADE';
  ELSIF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='portfolio_value_daily_detailed' AND c.relkind IN ('r','p')
  ) THEN
    EXECUTE 'DROP TABLE public.portfolio_value_daily_detailed CASCADE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='portfolio_value_daily_acct' AND c.relkind='m'
  ) THEN
    EXECUTE 'DROP MATERIALIZED VIEW public.portfolio_value_daily_acct CASCADE';
  ELSIF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='portfolio_value_daily_acct' AND c.relkind IN ('r','p')
  ) THEN
    EXECUTE 'DROP TABLE public.portfolio_value_daily_acct CASCADE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='portfolio_value_daily' AND c.relkind='m'
  ) THEN
    EXECUTE 'DROP MATERIALIZED VIEW public.portfolio_value_daily CASCADE';
  ELSIF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='portfolio_value_daily' AND c.relkind IN ('r','p')
  ) THEN
    EXECUTE 'DROP TABLE public.portfolio_value_daily CASCADE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='portfolio_value_monthly' AND c.relkind='m'
  ) THEN
    EXECUTE 'DROP MATERIALIZED VIEW public.portfolio_value_monthly CASCADE';
  ELSIF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='portfolio_value_monthly' AND c.relkind IN ('r','p')
  ) THEN
    EXECUTE 'DROP TABLE public.portfolio_value_monthly CASCADE';
  END IF;
END $$ LANGUAGE plpgsql;

-- 2) Aggregation tables (incremental, not MVs)
CREATE TABLE IF NOT EXISTS public.portfolio_value_daily_detailed (
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  date date NOT NULL,
  asset_value numeric(20,10) DEFAULT 0,
  CONSTRAINT portfolio_value_daily_detailed_pkey PRIMARY KEY (user_id, asset_id, date)
);

CREATE TABLE IF NOT EXISTS public.portfolio_value_daily_acct (
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  date date NOT NULL,
  total_value numeric(20,10) DEFAULT 0,
  CONSTRAINT portfolio_value_daily_acct_pkey PRIMARY KEY (user_id, account_id, date)
);

CREATE TABLE IF NOT EXISTS public.portfolio_value_daily (
  user_id uuid NOT NULL,
  date date NOT NULL,
  total_value numeric(20,10) DEFAULT 0,
  CONSTRAINT portfolio_value_daily_pkey PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.portfolio_value_monthly (
  user_id uuid NOT NULL,
  month date NOT NULL,
  month_value numeric(20,10) DEFAULT 0,
  CONSTRAINT portfolio_value_monthly_pkey PRIMARY KEY (user_id, month)
);

-- 3) Permissions: revoke direct access from anon/authenticated; allow service roles
DO $$ BEGIN
  PERFORM 1;
  EXCEPTION WHEN undefined_table THEN NULL;
END $$;

REVOKE ALL ON TABLE public.portfolio_value_daily_detailed FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.portfolio_value_daily_acct     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.portfolio_value_daily          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.portfolio_value_monthly        FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portfolio_value_daily_detailed TO service_role, supabase_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portfolio_value_daily_acct     TO service_role, supabase_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portfolio_value_daily          TO service_role, supabase_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portfolio_value_monthly        TO service_role, supabase_admin;

-- 4) Clean up old/duplicate objects
DROP FUNCTION IF EXISTS public.trg_events_recalc_acct();

-- Drop redundant indexes if they exist (were for MVs or duplicates)
DROP INDEX IF EXISTS public.idx_pvdd_user_asset_date;
DROP INDEX IF EXISTS public.ux_pvda_user_acct_date;
DROP INDEX IF EXISTS public.ux_pvd_user_date;
DROP INDEX IF EXISTS public.ux_pvm_user_month;

-- 5) Ensure triggers are present on daily_positions_acct for incremental aggregates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_daily_positions_acct_after_insert_update'
  ) THEN
    EXECUTE 'CREATE TRIGGER trg_daily_positions_acct_after_insert_update
             AFTER INSERT OR UPDATE ON public.daily_positions_acct
             FOR EACH ROW EXECUTE FUNCTION public.refresh_portfolio_mvs_incremental();';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_daily_positions_acct_after_delete'
  ) THEN
    EXECUTE 'CREATE TRIGGER trg_daily_positions_acct_after_delete
             AFTER DELETE ON public.daily_positions_acct
             FOR EACH ROW EXECUTE FUNCTION public.refresh_portfolio_mvs_incremental();';
  END IF;
END $$ LANGUAGE plpgsql;

-- 6) Ensure statement-level triggers on events (process in batches)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'trg_events_recalc_acct_ins'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 't_events_recalc_acct_ins'
  ) THEN
    EXECUTE 'CREATE TRIGGER t_events_recalc_acct_ins AFTER INSERT ON public.events
             REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_events_recalc_acct_ins();';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'trg_events_recalc_acct_upd'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 't_events_recalc_acct_upd'
  ) THEN
    EXECUTE 'CREATE TRIGGER t_events_recalc_acct_upd AFTER UPDATE ON public.events
             REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_events_recalc_acct_upd();';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'trg_events_recalc_acct_del'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 't_events_recalc_acct_del'
  ) THEN
    EXECUTE 'CREATE TRIGGER t_events_recalc_acct_del AFTER DELETE ON public.events
             REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_events_recalc_acct_del();';
  END IF;
END $$ LANGUAGE plpgsql;

COMMIT;

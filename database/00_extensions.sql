-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()
-- HTTP client for price fetchers (pgsql-http)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS http;
EXCEPTION WHEN undefined_file THEN
  RAISE NOTICE 'Extension http is not available in this environment. Price fetchers may not work server-side.';
END $$;

-- Scheduler for daily price refresh
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN undefined_file THEN
  RAISE NOTICE 'Extension pg_cron is not available. You can schedule refresh via Supabase Scheduler.';
END $$;

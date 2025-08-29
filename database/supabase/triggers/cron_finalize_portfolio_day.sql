-- Schedule daily portfolio finalization at 00:05 UTC for the previous day
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    -- Run after price refresh (03:00 UTC) to guarantee prices first
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_finalize_portfolio_day') THEN
      UPDATE cron.job
         SET schedule = '10 3 * * *',
             command  = 'SELECT public.fn_finalize_portfolio_day((current_date - interval ''1 day'')::date);'
       WHERE jobname = 'daily_finalize_portfolio_day';
    ELSE
      PERFORM cron.schedule(
        'daily_finalize_portfolio_day',
        '10 3 * * *',
        'SELECT public.fn_finalize_portfolio_day((current_date - interval ''1 day'')::date);'
      );
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not available; schedule fn_finalize_portfolio_day via external scheduler.';
  END IF;
END $$;
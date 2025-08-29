-- Schedule daily refresh of all asset prices at 03:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_refresh_all_asset_prices') THEN
      PERFORM cron.schedule('daily_refresh_all_asset_prices', '0 3 * * *', $$SELECT public.refresh_all_asset_prices();$$);
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not available; schedule refresh_all_asset_prices via external scheduler.';
  END IF;
END $$;

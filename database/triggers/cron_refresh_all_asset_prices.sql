-- Schedule daily refresh of all asset prices at 03:00 UTC
DO $$
DECLARE
  job_exists BOOLEAN := FALSE;
BEGIN
  -- Verificar se pg_cron está disponível
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    RAISE NOTICE 'pg_cron extension não está instalada. Para instalar: CREATE EXTENSION pg_cron;';
    RAISE NOTICE 'Alternativa: Configure um scheduler externo para executar: SELECT public.refresh_all_asset_prices();';
    RETURN;
  END IF;

  RAISE NOTICE 'pg_cron extension encontrada ✓';

  -- Verificar se função refresh_all_asset_prices existe
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_all_asset_prices') THEN
    RAISE EXCEPTION 'Função refresh_all_asset_prices não encontrada. Execute primeiro o script da função.';
  END IF;

  -- Verificar se o schema cron existe
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE EXCEPTION 'Schema cron não existe. Verifique a instalação do pg_cron.';
  END IF;

  -- Verificar se job já existe
  BEGIN
    SELECT COUNT(*) > 0 INTO job_exists 
    FROM cron.job 
    WHERE jobname = 'daily_refresh_all_asset_prices';
  EXCEPTION
    WHEN undefined_table THEN
      RAISE EXCEPTION 'Tabela cron.job não existe. Verifique se pg_cron foi configurado corretamente.';
  END;

  IF job_exists THEN
    RAISE NOTICE 'Job daily_refresh_all_asset_prices já existe ✓';
  ELSE
    -- Criar o job
    PERFORM cron.schedule(
      'daily_refresh_all_asset_prices',
      '0 3 * * *', 
      'SELECT public.refresh_all_asset_prices();'
    );
    RAISE NOTICE 'Job daily_refresh_all_asset_prices criado com sucesso ✓';
    RAISE NOTICE 'Agendado para executar diariamente às 03:00 UTC';
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao configurar cron job: %', SQLERRM;
    RAISE NOTICE 'Configure manualmente ou use scheduler externo para: SELECT public.refresh_all_asset_prices();';
END $$;

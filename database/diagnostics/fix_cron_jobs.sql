-- Script para forçar a criação dos cron jobs necessários
-- Execute este script para criar/recriar os cron jobs

DO $$
DECLARE
  job_exists BOOLEAN;
BEGIN
  -- Verificar se pg_cron está disponível
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension não está instalada. Instale com: CREATE EXTENSION pg_cron;';
  END IF;

  RAISE NOTICE 'pg_cron extension encontrada ✓';

  -- Verificar se schema cron existe
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE EXCEPTION 'Schema cron não existe. Verifique a instalação do pg_cron.';
  END IF;

  RAISE NOTICE 'Schema cron encontrado ✓';

  -- Verificar se função refresh_all_asset_prices existe
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_all_asset_prices') THEN
    RAISE EXCEPTION 'Função refresh_all_asset_prices não existe. Execute primeiro o script da função.';
  END IF;

  RAISE NOTICE 'Função refresh_all_asset_prices encontrada ✓';

  -- Remover job existente se houver (para recriar)
  BEGIN
    PERFORM cron.unschedule('daily_refresh_all_asset_prices');
    RAISE NOTICE 'Job existente removido';
  EXCEPTION 
    WHEN OTHERS THEN
      RAISE NOTICE 'Nenhum job existente para remover';
  END;

  -- Criar novo job
  PERFORM cron.schedule(
    'daily_refresh_all_asset_prices',  -- nome do job
    '0 3 * * *',                      -- cron schedule (03:00 UTC diariamente)
    $$SELECT public.refresh_all_asset_prices();$$  -- comando SQL
  );

  RAISE NOTICE 'Job daily_refresh_all_asset_prices criado com sucesso ✓';
  RAISE NOTICE 'Agendado para rodar diariamente às 03:00 UTC';

  -- Verificar se foi criado corretamente
  SELECT COUNT(*) > 0 INTO job_exists 
  FROM cron.job 
  WHERE jobname = 'daily_refresh_all_asset_prices';

  IF job_exists THEN
    RAISE NOTICE 'Verificação: Job existe na tabela cron.job ✓';
  ELSE
    RAISE EXCEPTION 'Erro: Job não foi encontrado na tabela cron.job após criação';
  END IF;

END $$;
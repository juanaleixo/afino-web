-- Script manual para criar o cron job daily_refresh_all_asset_prices
-- Execute este script diretamente no banco de dados

-- Primeiro, tentar remover job se existir (para evitar duplicatas)
DO $$
BEGIN
  PERFORM cron.unschedule('daily_refresh_all_asset_prices');
  RAISE NOTICE 'Job existente removido (se havia)';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Nenhum job existente para remover';
END $$;

-- Criar o job
SELECT cron.schedule(
  'daily_refresh_all_asset_prices',  -- nome do job
  '0 3 * * *',                      -- todo dia às 03:00 UTC  
  'SELECT public.refresh_all_asset_prices();'  -- comando a executar
) as job_id;

-- Verificar se foi criado
SELECT 
  jobname,
  schedule, 
  command,
  active,
  database
FROM cron.job 
WHERE jobname = 'daily_refresh_all_asset_prices';
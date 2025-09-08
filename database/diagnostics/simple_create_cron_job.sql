-- Versão mais simples para criar o cron job
-- Execute linha por linha se necessário

-- Criar o job (uma única linha)
SELECT cron.schedule('daily_refresh_all_asset_prices', '0 3 * * *', 'SELECT public.refresh_all_asset_prices();');

-- Verificar se foi criado
SELECT jobname, schedule, command, active FROM cron.job WHERE jobname = 'daily_refresh_all_asset_prices';
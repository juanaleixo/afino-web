-- Script de diagnóstico para verificar cron jobs
-- Execute este script para diagnosticar problemas com cron jobs

-- 1. Verificar se pg_cron está instalado
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
    THEN 'pg_cron extension DISPONÍVEL ✓'
    ELSE 'pg_cron extension NÃO DISPONÍVEL ✗'
  END as status_pg_cron;

-- 2. Verificar se o schema cron existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') 
    THEN 'Schema cron EXISTE ✓'
    ELSE 'Schema cron NÃO EXISTE ✗'
  END as status_schema_cron;

-- 3. Listar todos os jobs existentes (se cron estiver disponível)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    RAISE NOTICE 'Listando jobs existentes no cron:';
    PERFORM pg_notify('cron_jobs', 'Checking existing jobs...');
  ELSE
    RAISE NOTICE 'pg_cron não está disponível - não é possível listar jobs';
  END IF;
END $$;

-- 4. Tentar listar jobs via query (se disponível)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') AND 
     EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'cron' AND tablename = 'job') THEN
    RAISE NOTICE 'Tabela cron.job existe - verificando jobs';
  ELSE
    RAISE NOTICE 'Tabela cron.job não existe ou pg_cron não disponível';
  END IF;
END $$;

-- 5. Verificar função refresh_all_asset_prices existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_all_asset_prices') 
    THEN 'Função refresh_all_asset_prices EXISTE ✓'
    ELSE 'Função refresh_all_asset_prices NÃO EXISTE ✗'
  END as status_funcao;
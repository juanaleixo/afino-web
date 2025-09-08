-- Script para listar todos os cron jobs configurados
-- Execute este script para verificar quais jobs estão ativos

DO $$
BEGIN
  -- Verificar se pg_cron está disponível
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    RAISE NOTICE 'pg_cron extension não está instalada.';
    RETURN;
  END IF;

  RAISE NOTICE '=== CRON JOBS CONFIGURADOS ===';
  
  -- Listar jobs via loop (funciona mesmo se a tabela não puder ser acessada diretamente)
  DECLARE
    job_record RECORD;
    job_count INTEGER := 0;
  BEGIN
    FOR job_record IN 
      SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname
      FROM cron.job
    LOOP
      job_count := job_count + 1;
      RAISE NOTICE 'Job %: %', job_count, job_record.jobname;
      RAISE NOTICE '  ID: %', job_record.jobid;
      RAISE NOTICE '  Schedule: %', job_record.schedule;
      RAISE NOTICE '  Command: %', job_record.command;
      RAISE NOTICE '  Active: %', job_record.active;
      RAISE NOTICE '  Database: %', job_record.database;
      RAISE NOTICE '  ---';
    END LOOP;
    
    IF job_count = 0 THEN
      RAISE NOTICE 'Nenhum cron job encontrado.';
    ELSE
      RAISE NOTICE 'Total de jobs encontrados: %', job_count;
    END IF;
    
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'Tabela cron.job não acessível. pg_cron pode não estar configurado corretamente.';
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Permissões insuficientes para acessar cron.job.';
  END;
  
END $$;

-- Comando alternativo para verificar jobs (execute manualmente se necessário):
-- SELECT * FROM cron.job;
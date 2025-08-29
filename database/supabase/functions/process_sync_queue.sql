-- =========================================================
-- FUNÇÃO PARA PROCESSAR FILA DE RETRY
-- Reprocessa registros que falharam na sincronização inicial
-- =========================================================

CREATE OR REPLACE FUNCTION process_sync_queue()
RETURNS TABLE(processed_count INTEGER, failed_count INTEGER) AS $$
DECLARE
    sync_record RECORD;
    processed INTEGER := 0;
    failed INTEGER := 0;
BEGIN
    -- Processar apenas registros pendentes (falhas do HTTP)
    FOR sync_record IN
        SELECT * FROM sync_queue
        WHERE status = 'pending' AND retry_count < max_retries
        ORDER BY created_at ASC
        LIMIT 50 -- Batch pequeno para não sobrecarregar
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            -- Tentar sync novamente
            PERFORM net.http_post(
                url := current_setting('app.clickhouse_sync_url', true),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.clickhouse_sync_token', true)
                ),
                body := jsonb_build_object(
                    'table', sync_record.table_name,
                    'operation', sync_record.operation,
                    'record_id', sync_record.record_id,
                    'data', sync_record.data
                )
            );
            
            -- Sucesso - remover da fila
            DELETE FROM sync_queue WHERE id = sync_record.id;
            processed := processed + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Incrementar retry ou marcar como falha final
            UPDATE sync_queue 
            SET 
                retry_count = retry_count + 1,
                status = CASE WHEN retry_count + 1 >= max_retries THEN 'failed' ELSE 'pending' END,
                error_message = SQLERRM,
                processed_at = NOW()
            WHERE id = sync_record.id;
            
            failed := failed + 1;
        END;
    END LOOP;
    
    -- Limpar registros antigos (1 dia)
    DELETE FROM sync_queue WHERE created_at < NOW() - INTERVAL '1 day';
    
    RETURN QUERY SELECT processed, failed;
END;
$$ LANGUAGE plpgsql;

-- Comentário da função
COMMENT ON FUNCTION process_sync_queue() IS 'Processa fila de retry da sincronização com ClickHouse. Retorna número de registros processados e falhados.';
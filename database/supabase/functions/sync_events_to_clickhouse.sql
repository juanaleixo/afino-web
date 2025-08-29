-- =========================================================
-- FUNÇÃO DE SINCRONIZAÇÃO PARA CLICKHOUSE
-- Tenta HTTP direto, em caso de falha vai para fila de retry
-- =========================================================

CREATE OR REPLACE FUNCTION sync_events_to_clickhouse()
RETURNS TRIGGER AS $$
BEGIN
    -- Tentar sync direto via HTTP
    BEGIN
        PERFORM net.http_post(
            url := current_setting('app.clickhouse_sync_url', true),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.clickhouse_sync_token', true)
            ),
            body := jsonb_build_object(
                'table', TG_TABLE_NAME,
                'operation', TG_OP,
                'record_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
                'data', CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE row_to_json(NEW) END
            )
        );
        
        -- Sucesso - não precisa da fila
        
    EXCEPTION WHEN OTHERS THEN
        -- Falha HTTP - adicionar na fila para retry
        INSERT INTO sync_queue (table_name, record_id, operation, data) 
        VALUES (
            TG_TABLE_NAME,
            (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)::TEXT,
            TG_OP,
            CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE row_to_json(NEW) END
        );
    END;
    
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Comentário da função
COMMENT ON FUNCTION sync_events_to_clickhouse() IS 'Sincroniza mudanças de tabelas para ClickHouse via HTTP. Em caso de falha, adiciona na fila de retry.';
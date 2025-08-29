-- =========================================================
-- FUNÇÃO DE MONITORAMENTO DA FILA DE SYNC
-- Retorna estatísticas da sincronização para monitoramento
-- =========================================================

CREATE OR REPLACE FUNCTION sync_queue_stats()
RETURNS TABLE(status TEXT, count BIGINT, oldest TIMESTAMP) AS $$
BEGIN
    RETURN QUERY
    SELECT sq.status, COUNT(*), MIN(sq.created_at)
    FROM sync_queue sq
    GROUP BY sq.status
    ORDER BY 
        CASE sq.status
            WHEN 'failed' THEN 1
            WHEN 'pending' THEN 2  
            WHEN 'completed' THEN 3
        END;
END;
$$ LANGUAGE plpgsql;

-- Comentário da função
COMMENT ON FUNCTION sync_queue_stats() IS 'Retorna estatísticas da fila de sincronização para monitoramento (status, count, oldest)';
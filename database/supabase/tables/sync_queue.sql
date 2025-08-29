-- =========================================================
-- TABELA DE FILA DE SINCRONIZAÇÃO CLICKHOUSE
-- Para retry de falhas na sincronização automática
-- =========================================================

CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    
    -- Payload mínimo
    data JSONB NOT NULL,
    
    -- Controle de retry simples
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- Comentários da tabela
COMMENT ON TABLE sync_queue IS 'Fila de retry para sincronização com ClickHouse';
COMMENT ON COLUMN sync_queue.table_name IS 'Nome da tabela que foi modificada';
COMMENT ON COLUMN sync_queue.record_id IS 'ID do registro modificado';
COMMENT ON COLUMN sync_queue.operation IS 'Tipo de operação: INSERT, UPDATE ou DELETE';
COMMENT ON COLUMN sync_queue.data IS 'Payload JSON com dados do registro';
COMMENT ON COLUMN sync_queue.retry_count IS 'Número de tentativas de retry';
COMMENT ON COLUMN sync_queue.status IS 'Status atual: pending, completed, failed';
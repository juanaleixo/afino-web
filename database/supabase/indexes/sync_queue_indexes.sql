-- =========================================================
-- ÍNDICES DA TABELA SYNC_QUEUE
-- Para otimizar queries de retry e monitoramento
-- =========================================================

-- Índice composto para buscar registros pendentes ordenados por data
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, created_at);

-- Índice para filtrar por tipo de tabela
CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);

-- Comentários dos índices
COMMENT ON INDEX idx_sync_queue_status IS 'Otimiza busca de registros pendentes/failed por data de criação';
COMMENT ON INDEX idx_sync_queue_table IS 'Permite filtrar por tipo de tabela sincronizada';
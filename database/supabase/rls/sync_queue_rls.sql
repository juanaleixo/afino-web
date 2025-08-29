-- =========================================================
-- ROW LEVEL SECURITY PARA SYNC_QUEUE
-- Apenas service_role pode acessar a fila de sincronização
-- =========================================================

-- Habilitar RLS na tabela
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Policy restritiva: apenas service_role
DROP POLICY IF EXISTS "Service role only" ON sync_queue;

CREATE POLICY "Service role only" ON sync_queue
    FOR ALL USING (auth.role() = 'service_role');

-- Comentário da policy
COMMENT ON POLICY "Service role only" ON sync_queue IS 'Apenas service_role pode acessar a fila de sincronização com ClickHouse';
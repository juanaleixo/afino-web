-- =========================================================
-- TRIGGER DE SINCRONIZAÇÃO PARA TABELA EVENTS
-- Sincroniza mudanças em events para ClickHouse automaticamente
-- =========================================================

-- Events (mais importante - onde acontece a ação)
DROP TRIGGER IF EXISTS events_sync_trigger ON events;

CREATE TRIGGER events_sync_trigger
    AFTER INSERT OR UPDATE OR DELETE ON events
    FOR EACH ROW 
    EXECUTE FUNCTION sync_events_to_clickhouse();

-- Comentário do trigger
COMMENT ON TRIGGER events_sync_trigger ON events IS 'Sincroniza mudanças na tabela events para ClickHouse via webhook';
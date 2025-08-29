-- =========================================================
-- TRIGGER DE SINCRONIZAÇÃO PARA TABELA GLOBAL_ASSETS
-- Sincroniza mudanças em metadados de ativos para ClickHouse
-- =========================================================

-- Global Assets (metadados - menos crítico, pode ter delay)
DROP TRIGGER IF EXISTS assets_sync_trigger ON global_assets;

CREATE TRIGGER assets_sync_trigger
    AFTER INSERT OR UPDATE OR DELETE ON global_assets
    FOR EACH ROW 
    EXECUTE FUNCTION sync_events_to_clickhouse();

-- Comentário do trigger
COMMENT ON TRIGGER assets_sync_trigger ON global_assets IS 'Sincroniza mudanças na tabela global_assets para ClickHouse via webhook';
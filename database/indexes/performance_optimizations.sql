-- Performance optimization indexes for cache system
-- File: database/indexes/performance_optimizations.sql

-- Index for user profiles lookup (heavily used by cache system)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id_plan
ON user_profiles(user_id, plan);

-- Index for events timestamp queries (used for cache invalidation)
CREATE INDEX IF NOT EXISTS idx_events_user_created_at_desc 
ON events(user_id, created_at DESC);

-- Index for daily positions with final flag (heavily used)
CREATE INDEX IF NOT EXISTS idx_daily_positions_user_date_is_final 
ON daily_positions_acct(user_id, date, is_final) 
WHERE is_final = true;

-- Index for global assets symbol lookup (used by asset batch queries)
CREATE INDEX IF NOT EXISTS idx_global_assets_symbol_class
ON global_assets(symbol, class);

-- Index for global assets ID lookup (used by asset batch queries)  
CREATE INDEX IF NOT EXISTS idx_global_assets_id_symbol
ON global_assets(id, symbol);

-- Partial index for final daily positions (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_daily_positions_final_user_date_asset
ON daily_positions_acct(user_id, date, asset_id, value)
WHERE is_final = true AND value > 0;
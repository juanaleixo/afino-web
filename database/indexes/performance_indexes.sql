-- Performance optimization indexes
-- Add critical missing indexes for better query performance

-- EVENTS table indexes (most critical for timeline queries)
CREATE INDEX IF NOT EXISTS idx_events_user_tstamp ON public.events(user_id, tstamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_user_asset ON public.events(user_id, asset_symbol);
CREATE INDEX IF NOT EXISTS idx_events_user_account ON public.events(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_events_kind_tstamp ON public.events(kind, tstamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_tstamp ON public.events(tstamp DESC);

-- ACCOUNTS table indexes
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

-- CUSTOM_ASSETS table indexes  
CREATE INDEX IF NOT EXISTS idx_custom_assets_user_id ON public.custom_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_assets_user_class ON public.custom_assets(user_id, class);

-- GLOBAL_PRICE_DAILY table indexes
CREATE INDEX IF NOT EXISTS idx_global_price_daily_date ON public.global_price_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_global_price_daily_asset_date ON public.global_price_daily(asset_symbol, date DESC);

-- PORTFOLIO_VALUE tables indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_value_daily_date ON public.portfolio_value_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_value_monthly_month ON public.portfolio_value_monthly(month DESC);

-- CUSTOM_ASSET_VALUATIONS table indexes
CREATE INDEX IF NOT EXISTS idx_custom_asset_valuations_date ON public.custom_asset_valuations(date DESC);

-- DAILY_POSITIONS_ACCT additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_daily_positions_acct_user_date ON public.daily_positions_acct(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_positions_acct_user_asset ON public.daily_positions_acct(user_id, asset_id);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_events_user_tstamp_kind ON public.events(user_id, tstamp DESC, kind);

-- Partial indexes for frequently filtered data
CREATE INDEX IF NOT EXISTS idx_events_active_positions 
ON public.events(user_id, asset_symbol) 
WHERE kind IN ('buy', 'position_add', 'deposit');

SELECT 'Performance indexes created successfully' as status;
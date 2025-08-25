-- Additional performance indexes for Afino Finance
-- These indexes improve query performance for common access patterns

-- 1. Events table - Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_user_tstamp_kind 
ON public.events(user_id, tstamp DESC, kind)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_asset_tstamp 
ON public.events(asset_id, tstamp DESC)
WHERE asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_account_asset_tstamp 
ON public.events(account_id, asset_id, tstamp DESC)
WHERE account_id IS NOT NULL;

-- 2. Daily positions - Covering index for portfolio queries
CREATE INDEX IF NOT EXISTS idx_daily_positions_user_date_value 
ON public.daily_positions_acct(user_id, date DESC)
INCLUDE (value, units, is_final)
WHERE is_final = true;

-- 3. Global assets - Text search optimization
CREATE INDEX IF NOT EXISTS idx_global_assets_symbol_trgm 
ON public.global_assets USING gin(symbol gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_global_assets_label_ptbr_trgm 
ON public.global_assets USING gin(label_ptbr gin_trgm_ops);

-- 4. Custom assets - User lookup optimization
CREATE INDEX IF NOT EXISTS idx_custom_assets_user_label 
ON public.custom_assets(user_id, label);

-- 5. Accounts - Quick user account lookup
CREATE INDEX IF NOT EXISTS idx_accounts_user_currency 
ON public.accounts(user_id, currency);

-- 6. Portfolio value tables - Date range queries
CREATE INDEX IF NOT EXISTS idx_portfolio_daily_user_date_range 
ON public.portfolio_value_daily(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_monthly_user_month 
ON public.portfolio_value_monthly(user_id, month_eom DESC);

-- 7. User profiles - Plan filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan 
ON public.user_profiles(plan)
WHERE plan IS NOT NULL;

-- 8. Subscriptions - Active subscription lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status 
ON public.subscriptions(user_id, status)
WHERE status = 'active';

-- Analyze tables to update statistics
ANALYZE public.events;
ANALYZE public.daily_positions_acct;
ANALYZE public.global_assets;
ANALYZE public.accounts;
ANALYZE public.portfolio_value_daily;
ANALYZE public.portfolio_value_monthly;
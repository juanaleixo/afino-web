-- =========================================================
-- ANÁLISE DO SCHEMA ATUAL DO SUPABASE
-- Mapeamento para migração para ClickHouse
-- =========================================================

-- 1. ESTRUTURA EXISTENTE QUE PRECISA SER MIGRADA

-- Tabela: daily_positions_acct (principal para cálculos)
/*
CREATE TABLE daily_positions_acct (
    user_id UUID,
    asset_id STRING, 
    account_id UUID,
    date DATE,
    units DECIMAL,
    value DECIMAL, -- market value (units * current_price)
    is_final BOOLEAN, -- indica se é o cálculo final do dia
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
*/

-- RPCs EXISTENTES QUE PRECISAM SER REPLICADOS:

-- 2. api_portfolio_daily(p_from, p_to)
-- Retorna: { date, total_value }
-- Implementação: SELECT date, SUM(value) FROM daily_positions_acct WHERE is_final=true GROUP BY date

-- 3. api_portfolio_monthly(p_from, p_to) 
-- Retorna: { month_eom, total_value }
-- Implementação: Deriva do daily agrupando por mês

-- 4. api_holdings_at(p_date)
-- Retorna: { asset_id, units, value }
-- Implementação: SELECT asset_id, SUM(units), SUM(value) FROM daily_positions_acct WHERE date=p_date AND is_final=true

-- 5. api_holdings_accounts(p_date)
-- Retorna: { account_id, asset_id, units, value }
-- Implementação: Similar ao holdings_at mas com breakdown por conta

-- 6. api_holdings_detailed_at(p_date)
-- Retorna: holdings + asset metadata (symbol, class, etc.)
-- Join com global_assets

-- 7. api_portfolio_daily_detailed(p_from, p_to)
-- Retorna: breakdown diário por asset com percentuais

-- =========================================================
-- PROPOSTA DE MIGRAÇÃO PARA CLICKHOUSE
-- =========================================================

-- As tabelas atuais podem ser migradas para estruturas mais eficientes:

-- MAPEAMENTO:
-- daily_positions_acct → daily_positions_ch (otimizada)
-- global_assets → assets_metadata (já criada)
-- RPC functions → Materialized Views + Helper queries

-- TRIGGERS necessários no Supabase:
-- 1. daily_positions_acct → sync para ClickHouse
-- 2. global_assets → sync para assets_metadata
-- 3. events → sync para events_stream (já implementado)
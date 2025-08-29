-- =========================================================
-- SCHEMA CLICKHOUSE SIMPLIFICADO - ESTRUTURA OTIMIZADA
-- Foco: Preços diários + Posições automáticas + Performance
-- =========================================================

-- 1) TABELA DE PREÇOS DIÁRIOS (FONTE ÚNICA DE VERDADE)
CREATE TABLE IF NOT EXISTS daily_prices (
    asset_id String,
    date Date,
    
    -- Preço único do dia (close é o principal)
    price Float64,
    
    -- Dados OHLCV opcionais para análises
    open_price Nullable(Float64),
    high_price Nullable(Float64), 
    low_price Nullable(Float64),
    volume Nullable(Float64),
    
    -- Metadados
    source Enum8('api' = 1, 'manual' = 2, 'calculated' = 3) DEFAULT 'api',
    currency String DEFAULT 'BRL',
    confidence Float32 DEFAULT 1.0,
    
    -- Timestamps
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date) 
ORDER BY (asset_id, date)
TTL date + INTERVAL 2 YEAR
SETTINGS index_granularity = 8192;

-- 2) TABELA DE POSIÇÕES DIÁRIAS SIMPLIFICADA
CREATE TABLE IF NOT EXISTS daily_positions (
    user_id String,
    asset_id String,
    account_id Nullable(String),
    date Date,
    
    -- Posição acumulada (calculada automaticamente)
    units Float64,
    avg_price Float64, -- preço médio de aquisição
    
    -- Valores calculados automaticamente via JOIN com daily_prices
    market_price Float64 MATERIALIZED (
        dictGet('prices_dict', 'price', (asset_id, date))
    ),
    market_value Float64 MATERIALIZED (units * market_price),
    
    -- P&L automático
    unrealized_pnl Float64 MATERIALIZED (
        units * (market_price - avg_price)
    ),
    
    -- Flags de controle
    is_final UInt8 DEFAULT 1,
    
    -- Timestamps
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, asset_id, account_id, date)
SETTINGS index_granularity = 8192;

-- 3) DICTIONARY PARA LOOKUP RÁPIDO DE PREÇOS
CREATE DICTIONARY IF NOT EXISTS prices_dict (
    asset_id String,
    date Date,
    price Float64
)
PRIMARY KEY (asset_id, date)
SOURCE(CLICKHOUSE(TABLE 'daily_prices'))
LAYOUT(COMPLEX_KEY_HASHED())
LIFETIME(MIN 300 MAX 600); -- Cache 5-10 minutos

-- 4) MATERIALIZED VIEW: CÁLCULO AUTOMÁTICO DE POSIÇÕES
-- Calcula posições diárias baseado nos eventos, usando preços da tabela daily_prices
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_positions_auto_mv TO daily_positions AS
WITH running_positions AS (
    SELECT
        user_id,
        asset_id,
        account_id,
        date,
        
        -- Posição acumulada (running sum)
        sum(units_delta) OVER (
            PARTITION BY user_id, asset_id, account_id
            ORDER BY date, timestamp
            ROWS UNBOUNDED PRECEDING
        ) AS running_units,
        
        -- Preço médio ponderado (simplificado por buy events)
        avgIf(coalesce(price_override, price_close, 1.0), kind IN ('buy', 'position_add')) OVER (
            PARTITION BY user_id, asset_id, account_id
            ORDER BY date, timestamp
            ROWS UNBOUNDED PRECEDING
        ) AS avg_price
        
    FROM events_stream
    WHERE units_delta != 0
),

-- Agrupar por dia (último valor do dia)
daily_aggregated AS (
    SELECT 
        user_id,
        asset_id,
        account_id,
        date,
        argMax(running_units, timestamp) AS final_units,
        argMax(avg_price, timestamp) AS final_avg_price
    FROM running_positions
    GROUP BY user_id, asset_id, account_id, date
)

SELECT
    user_id,
    asset_id,
    account_id,
    date,
    final_units AS units,
    coalesce(final_avg_price, 1.0) AS avg_price,
    1 AS is_final,
    now() AS created_at,
    now() AS updated_at
FROM daily_aggregated
WHERE final_units > 0.001; -- Filtrar posições zeradas

-- 5) VIEWS SIMPLIFICADAS (COMPATÍVEIS COM RPCs EXISTENTES)

-- api_portfolio_daily(p_from, p_to)
CREATE VIEW IF NOT EXISTS v_portfolio_daily AS
SELECT 
    dp.user_id,
    dp.date,
    sum(dp.units * coalesce(pr.price, dp.avg_price)) AS total_value
FROM daily_positions dp
LEFT JOIN daily_prices pr ON (dp.asset_id = pr.asset_id AND dp.date = pr.date)
WHERE dp.is_final = 1
GROUP BY dp.user_id, dp.date
ORDER BY dp.user_id, dp.date;

-- api_portfolio_monthly(p_from, p_to)
CREATE VIEW IF NOT EXISTS v_portfolio_monthly AS
SELECT 
    user_id,
    toLastDayOfMonth(date) AS month_eom,
    argMax(total_value, date) AS total_value
FROM v_portfolio_daily
GROUP BY user_id, toLastDayOfMonth(date)
ORDER BY user_id, month_eom;

-- api_holdings_at(p_date)
CREATE VIEW IF NOT EXISTS v_holdings_at AS
SELECT 
    dp.user_id,
    dp.asset_id,
    sum(dp.units) AS units,
    argMax(coalesce(pr.price, dp.avg_price), dp.date) AS current_price,
    sum(dp.units * coalesce(pr.price, dp.avg_price)) AS value,
    dictGetString('assets_dict', 'symbol', dp.asset_id) AS symbol,
    dictGetString('assets_dict', 'class', dp.asset_id) AS class
FROM daily_positions dp
LEFT JOIN daily_prices pr ON (dp.asset_id = pr.asset_id AND dp.date = pr.date)
WHERE dp.is_final = 1
GROUP BY dp.user_id, dp.asset_id
HAVING units > 0.001
ORDER BY dp.user_id, value DESC;

-- api_holdings_accounts(p_date)
CREATE VIEW IF NOT EXISTS v_holdings_accounts AS  
SELECT
    dp.user_id,
    dp.account_id,
    dp.asset_id,
    sum(dp.units) AS units,
    argMax(coalesce(pr.price, dp.avg_price), dp.date) AS current_price,
    sum(dp.units * coalesce(pr.price, dp.avg_price)) AS value
FROM daily_positions dp
LEFT JOIN daily_prices pr ON (dp.asset_id = pr.asset_id AND dp.date = pr.date)
WHERE dp.is_final = 1 AND dp.account_id IS NOT NULL
GROUP BY dp.user_id, dp.account_id, dp.asset_id
HAVING units > 0.001
ORDER BY dp.user_id, dp.account_id, value DESC;

-- 6) VIEW PARA PREÇOS ATUAIS (ÚLTIMO PREÇO CONHECIDO)
CREATE VIEW IF NOT EXISTS v_current_prices AS
SELECT 
    dp.asset_id,
    dictGetString('assets_dict', 'symbol', dp.asset_id) AS symbol,
    argMax(pr.price, pr.date) AS current_price,
    argMax(pr.source, pr.date) AS price_source,
    argMax(pr.date, pr.date) AS last_updated
FROM daily_prices pr
INNER JOIN (
    SELECT DISTINCT asset_id FROM daily_positions WHERE date >= today() - 30
) dp ON pr.asset_id = dp.asset_id
WHERE pr.date >= today() - 30
GROUP BY dp.asset_id
ORDER BY last_updated DESC;

-- =========================================================
-- SYNC SIMPLIFICADO - SEM TRIGGERS COMPLEXOS NO SUPABASE
-- =========================================================

-- 7) PROCESSO DE SYNC SIMPLIFICADO (APENAS EVENTS)
-- O sync dos events já está implementado via webhook
-- As posições são calculadas automaticamente via Materialized View

-- 8) SYNC DE PREÇOS (BATCH PROCESS - PODE SER DAILY VIA CRON)
-- INSERT INTO daily_prices (asset_id, date, price, source) VALUES ...
-- Exemplo via API externa ou processo batch

-- =========================================================
-- VANTAGENS DA ESTRUTURA SIMPLIFICADA:
-- =========================================================
-- 
-- 1. PREÇOS CENTRALIZADOS: Uma única tabela daily_prices para todos os ativos
-- 2. CÁLCULO AUTOMÁTICO: Materialized View calcula posições automaticamente
-- 3. PERFORMANCE ALTA: Queries diretas sem múltiplos JOINs
-- 4. MANUTENÇÃO SIMPLES: Menos triggers, menos complexidade
-- 5. CUSTO REDUZIDO: Sem sobrecarga no Supabase com triggers pesados
-- 
-- FLUXO DE DADOS:
-- 1. Events (via webhook) → events_stream
-- 2. Preços (batch/API) → daily_prices  
-- 3. Materialized View → daily_positions (automático)
-- 4. Views → consultas rápidas (substituem RPCs)
-- 
-- QUERIES DE EXEMPLO:
-- - Portfolio diário: SELECT * FROM v_portfolio_daily WHERE user_id = ? AND date BETWEEN ? AND ?
-- - Holdings atuais: SELECT * FROM v_holdings_at WHERE user_id = ?
-- - Preços atuais: SELECT * FROM v_current_prices WHERE asset_id IN (?)
-- =========================================================
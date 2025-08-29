-- =========================================================
-- Afino ClickHouse Analytics Schema (corrigido e completo)
-- =========================================================

-- Recomendado: usar um DATABASE dedicado
-- CREATE DATABASE IF NOT EXISTS afino_analytics;
-- USE afino_analytics;

-- 1) TABELA PRINCIPAL DE EVENTOS
CREATE TABLE IF NOT EXISTS events_stream (
    -- Identificadores
    user_id String,
    event_id String,
    asset_id String,
    account_id Nullable(String),

    -- Dados temporais
    timestamp DateTime64(3, 'UTC'),
    date Date MATERIALIZED toDate(timestamp),
    hour UInt8 MATERIALIZED toHour(timestamp),

    -- Tipo e dados do evento
    kind Enum8(
        'deposit' = 1,
        'withdraw' = 2, 
        'buy' = 3,
        'sell' = 4,
        'position_add' = 5,
        'position_remove' = 6,
        'valuation' = 7,
        'dividend' = 8,
        'split' = 9
    ),

    -- Valores financeiros
    units_delta Float64,
    price_override Nullable(Float64),
    price_close   Nullable(Float64),
    currency String DEFAULT 'BRL',

    -- Metadata
    notes Nullable(String),
    source Enum8('manual' = 1, 'import' = 2, 'api' = 3) DEFAULT 'manual',

    -- Campos derivados
    year    UInt16 MATERIALIZED toYear(date),
    month   UInt8  MATERIALIZED toMonth(date),
    quarter UInt8  MATERIALIZED toQuarter(date),

    -- Índices para filtro rápido
    INDEX idx_user_date (user_id, date) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_asset (asset_id)          TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_kind  (kind)              TYPE set(10)            GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, date, event_id, timestamp)
TTL date + INTERVAL 7 YEAR
SETTINGS index_granularity = 8192;

-- 2) SNAPSHOT DIÁRIO PRÉ-CALCULADO
CREATE TABLE IF NOT EXISTS portfolio_daily (
    user_id String,
    date Date,

    -- Valores agregados
    total_value  Float64,
    cash_balance Float64,
    assets_value Float64,

    -- Contadores
    total_assets    UInt32,
    total_positions UInt32,

    -- Métricas de performance
    daily_change     Float64 DEFAULT 0,
    daily_return_pct Float64 DEFAULT 0,

    -- Breakdown por ativo (JSON flexível: {"BTC": 1234.5, "PETR4": 999.1, ...})
    asset_breakdown String,

    -- Timestamps
    calculated_at DateTime DEFAULT now(),
    updated_at    DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, date)
SETTINGS index_granularity = 8192;

-- 3) POSIÇÕES POR ATIVO (GRANULAR)
CREATE TABLE IF NOT EXISTS asset_positions (
    user_id String,
    asset_id String,
    account_id Nullable(String),
    date Date,

    -- Posição atual
    units         Float64,
    avg_price     Float64,
    current_price Float64,
    market_value  Float64,

    -- Performance
    unrealized_pnl     Float64,
    unrealized_pnl_pct Float64,

    -- Métricas rolling (placeholders)
    volatility_30d   Float64 DEFAULT 0,
    sharpe_30d       Float64 DEFAULT 0,
    max_drawdown_30d Float64 DEFAULT 0,

    -- Metadata
    currency  String DEFAULT 'BRL',
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, asset_id, date)
SETTINGS index_granularity = 8192;

-- 4) AGREGADOS MENSAIS DO PORTFÓLIO
CREATE TABLE IF NOT EXISTS portfolio_monthly (
    user_id String,
    month_eom Date, -- end of month

    -- Valores
    total_value       Float64,
    monthly_change    Float64,
    monthly_return_pct Float64,

    -- Estatísticas do mês
    max_value  Float64,
    min_value  Float64,
    avg_value  Float64,
    volatility Float64,

    -- Fluxos do mês
    total_deposits    Float64 DEFAULT 0,
    total_withdrawals Float64 DEFAULT 0,
    net_flow          Float64 DEFAULT 0,

    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYear(month_eom)
ORDER BY (user_id, month_eom)
SETTINGS index_granularity = 8192;

-- 5) METADADOS DE ATIVOS (CACHE LOCAL)
CREATE TABLE IF NOT EXISTS assets_metadata (
    asset_id String,
    symbol   String,
    name     String,
    class Enum8(
        'currency'    = 1,
        'stock'       = 2,
        'crypto'      = 3,
        'bond'        = 4,
        'commodity'   = 5,
        'real_estate' = 6,
        'other'       = 7
    ),
    currency String DEFAULT 'BRL',
    exchange Nullable(String),
    sector   Nullable(String),

    -- Para sync com fonte externa
    external_id Nullable(String),
    last_updated DateTime DEFAULT now(),

    -- Metadata adicional em JSON
    metadata String DEFAULT '{}'  -- JSON
)
ENGINE = ReplacingMergeTree(last_updated)
ORDER BY asset_id
SETTINGS index_granularity = 8192;

-- 6) DICTIONARY PARA LOOKUP RÁPIDO (com credenciais explícitas)
DROP DICTIONARY IF EXISTS assets_dict;

CREATE DICTIONARY assets_dict
(
    asset_id String,
    symbol   String,
    name     String,
    class    String,
    currency String
)
PRIMARY KEY asset_id
SOURCE(CLICKHOUSE(
    DB 'default'          -- seu database
    TABLE 'assets_metadata'       -- tabela local
    USER 'default'                  -- seu usuário (não-default)
    PASSWORD '52863152'           -- se houver
))
LAYOUT(HASHED())
LIFETIME(MIN 300 MAX 600);

-- 7) MATERIALIZED VIEW: PORTFÓLIO DIÁRIO
CREATE MATERIALIZED VIEW IF NOT EXISTS portfolio_daily_mv
TO portfolio_daily AS
WITH
-- Posições acumuladas e último preço do dia
running_positions AS (
    SELECT
        user_id,
        date,
        asset_id,
        account_id,

        -- Posição acumulada por ativo/conta
        sum(units_delta) OVER (
            PARTITION BY user_id, asset_id, account_id
            ORDER BY date, timestamp
            ROWS UNBOUNDED PRECEDING
        ) AS running_units,

        -- Último preço conhecido dentro do dia
        argMax(coalesce(price_override, price_close, 1), timestamp) OVER (
            PARTITION BY user_id, asset_id, account_id, date
        ) AS latest_price
    FROM events_stream
    WHERE units_delta != 0 OR price_override IS NOT NULL
),

-- Valores diários por usuário
daily_values AS (
    SELECT
        user_id,
        date,

        sum(running_units * latest_price) AS total_value,

        -- Separar cash vs assets (assumindo 'BRL' representa caixa)
        sumIf(running_units * latest_price, asset_id = 'BRL')  AS cash_balance,
        sumIf(running_units * latest_price, asset_id != 'BRL') AS assets_value,

        -- Contadores
        countIf(running_units > 0)                         AS total_positions,
        uniqIf(asset_id, running_units > 0)                AS total_assets,

        -- Breakdown por ativo (JSON)
        toJSONString(
            mapFromArrays(
                arrayMap(x -> x.1, groupArray( (asset_id, running_units * latest_price) )),
                arrayMap(x -> x.2, groupArray( (asset_id, running_units * latest_price) ))
            )
        ) AS asset_breakdown
    FROM running_positions
    WHERE running_units > 0.001
    GROUP BY user_id, date
)

SELECT
    user_id,
    date,
    total_value,
    cash_balance,
    assets_value,
    total_assets,
    total_positions,

    -- Variação diária (não referenciar alias no mesmo nível)
    (total_value
        - lagInFrame(total_value, 1) OVER (PARTITION BY user_id ORDER BY date)
    ) AS daily_change,

    -- Retorno diário em %
    if(
        lagInFrame(total_value, 1) OVER (PARTITION BY user_id ORDER BY date) > 0,
        (
            total_value
            - lagInFrame(total_value, 1) OVER (PARTITION BY user_id ORDER BY date)
        )
        / lagInFrame(total_value, 1) OVER (PARTITION BY user_id ORDER BY date) * 100,
        0
    ) AS daily_return_pct,

    asset_breakdown,
    now() AS calculated_at,
    now() AS updated_at
FROM daily_values;

-- 8) MATERIALIZED VIEW: POSIÇÕES POR ATIVO (com PM ponderado por compras)
CREATE MATERIALIZED VIEW IF NOT EXISTS asset_positions_mv
TO asset_positions AS
WITH base AS (
    SELECT
        user_id,
        asset_id,
        account_id,
        date,
        timestamp,
        kind,
        units_delta,
        coalesce(price_override, price_close) AS px
    FROM events_stream
    WHERE units_delta != 0 OR price_override IS NOT NULL
),
running AS (
    SELECT
        user_id,
        asset_id,
        account_id,
        date,

        -- Unidades acumuladas (compras e vendas)
        sum(units_delta) OVER (
            PARTITION BY user_id, asset_id, account_id
            ORDER BY date, timestamp
            ROWS UNBOUNDED PRECEDING
        ) AS running_units,

        -- Custo acumulado apenas de entradas (PM ponderado por compras)
        sumIf(units_delta * px, kind IN ('buy','position_add')) OVER (
            PARTITION BY user_id, asset_id, account_id
            ORDER BY date, timestamp
            ROWS UNBOUNDED PRECEDING
        ) AS cum_cost_in,

        sumIf(units_delta,       kind IN ('buy','position_add')) OVER (
            PARTITION BY user_id, asset_id, account_id
            ORDER BY date, timestamp
            ROWS UNBOUNDED PRECEDING
        ) AS cum_units_in,

        -- Preço corrente (último do dia)
        argMax(px, timestamp) OVER (
            PARTITION BY user_id, asset_id, account_id, date
        ) AS current_price
    FROM base
)

SELECT
    user_id,
    asset_id,
    account_id,
    date,

    running_units AS units,

    if(cum_units_in > 0, cum_cost_in / NULLIF(cum_units_in, 0), current_price) AS avg_price,
    current_price,
    running_units * current_price AS market_value,

    -- P&L não realizado
    running_units * (current_price - if(cum_units_in > 0, cum_cost_in / NULLIF(cum_units_in, 0), current_price)) AS unrealized_pnl,
    if(
        (cum_units_in > 0) AND (cum_cost_in / NULLIF(cum_units_in, 0) > 0),
        (current_price - (cum_cost_in / NULLIF(cum_units_in, 0))) / (cum_cost_in / NULLIF(cum_units_in, 0)) * 100,
        0
    ) AS unrealized_pnl_pct,

    0 AS volatility_30d,
    0 AS sharpe_30d,
    0 AS max_drawdown_30d,

    'BRL' AS currency,
    now() AS updated_at
FROM running
WHERE running_units > 0.001;

-- 9) VIEW AUXILIAR: PORTFÓLIO CORRENTE (usa último dia disponível por usuário)
CREATE VIEW IF NOT EXISTS v_current_portfolio AS
WITH last_day AS (
    SELECT user_id, max(date) AS d
    FROM asset_positions
    GROUP BY user_id
)
SELECT
    p.user_id,
    p.asset_id,
    dictGetString('assets_dict', 'symbol',  p.asset_id) AS symbol,
    dictGetString('assets_dict', 'class',   p.asset_id) AS class,
    sum(p.units) AS total_units,
    argMax(p.current_price, p.date) AS latest_price,
    total_units * latest_price AS market_value,
    sum(p.unrealized_pnl) AS total_pnl
FROM asset_positions AS p
INNER JOIN last_day AS ld
    ON p.user_id = ld.user_id AND p.date = ld.d
GROUP BY p.user_id, p.asset_id
HAVING total_units > 0.001
ORDER BY p.user_id, market_value DESC;

-- =========================================================
-- Notas:
-- - Ajuste HOST/PORT/USER/PASSWORD/DB do DICTIONARY (assets_dict).
-- - MVs dependem do dicionário; crie o dictionary antes das MVs.
-- - Para breakdown por CLASSE em JSON: adapte o daily_values somando por
--   dictGetString('assets_dict','class', asset_id) e gere mapFromArrays por classe.
-- =========================================================
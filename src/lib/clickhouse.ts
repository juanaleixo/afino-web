import { createClient, type ClickHouseClient } from '@clickhouse/client'

// ClickHouse client configuration
const clickhouseUrl = process.env.NEXT_PUBLIC_CLICKHOUSE_URL
const clickhouseUser = process.env.NEXT_PUBLIC_CLICKHOUSE_USER
const clickhousePassword = process.env.NEXT_PUBLIC_CLICKHOUSE_PASSWORD
const clickhouseDatabase = process.env.NEXT_PUBLIC_CLICKHOUSE_DATABASE || 'afino'

// Safe client creation to avoid build-time errors
function createClickHouseSafe(): ClickHouseClient {
  if (clickhouseUrl && clickhouseUser && clickhousePassword) {
    return createClient({
      url: clickhouseUrl,
      username: clickhouseUser,
      password: clickhousePassword,
      database: clickhouseDatabase,
      compression: {
        response: true,
        request: false
      },
      max_open_connections: 10,
      request_timeout: 30000, // 30s
      clickhouse_settings: {
        // Otimizações para queries analíticas
        max_execution_time: 60, // 60s max query time
        max_memory_usage: '4000000000', // 4GB max memory
        use_uncompressed_cache: 1,
        optimize_read_in_order: 1,
        optimize_aggregation_in_order: 1,
      }
    })
  }
  
  const message = 'ClickHouse client is not configured. Set NEXT_PUBLIC_CLICKHOUSE_* environment variables.'
  return new Proxy({} as ClickHouseClient, {
    get() {
      throw new Error(message)
    }
  })
}

export const clickhouse = createClickHouseSafe()

// Types baseados no schema ClickHouse
export interface EventRecord {
  user_id: string
  event_id: string
  asset_id: string
  account_id?: string
  timestamp: string
  kind: 'deposit' | 'withdraw' | 'buy' | 'sell' | 'position_add' | 'position_remove' | 'valuation' | 'dividend' | 'split'
  units_delta: number
  price_override?: number
  price_close?: number
  currency?: string
  notes?: string
  source?: 'manual' | 'import' | 'api'
}

export interface PortfolioDailyRecord {
  user_id: string
  date: string
  total_value: number
  cash_balance: number
  assets_value: number
  total_assets: number
  total_positions: number
  daily_change: number
  daily_return_pct: number
  asset_breakdown: string // JSON
}

export interface AssetPositionRecord {
  user_id: string
  asset_id: string
  account_id?: string
  date: string
  units: number
  avg_price: number
  current_price: number
  market_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  volatility_30d: number
  sharpe_30d: number
  max_drawdown_30d: number
  currency: string
}

export interface AssetMetadata {
  asset_id: string
  symbol: string
  name: string
  class: 'currency' | 'stock' | 'crypto' | 'bond' | 'commodity' | 'real_estate' | 'other'
  currency: string
  exchange?: string
  sector?: string
  external_id?: string
  metadata?: Record<string, unknown>
}

// Helper functions para queries comuns
export class ClickHouseHelpers {
  // Escapar strings para queries seguras
  static escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\\/g, '\\\\')
  }

  // Formatar parâmetros para queries
  static formatParams(params: Record<string, unknown>): Record<string, string> {
    const formatted: Record<string, string> = {}
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        formatted[key] = this.escapeString(value)
      } else if (value instanceof Date) {
        formatted[key] = value.toISOString().split('T')[0]!
      } else if (typeof value === 'number') {
        formatted[key] = value.toString()
      } else if (value === null || value === undefined) {
        formatted[key] = 'NULL'
      } else {
        formatted[key] = String(value)
      }
    }
    
    return formatted
  }

  // Query builder para portfolio diário
  static buildPortfolioDailyQuery(
    userId: string,
    fromDate: string,
    toDate: string,
    granularity: 'daily' | 'monthly' = 'daily'
  ): string {
    if (granularity === 'monthly') {
      return `
        SELECT 
          toLastDayOfMonth(date) as month_eom,
          argMax(total_value, date) as total_value,
          argMax(daily_change, date) as monthly_change,
          argMax(daily_return_pct, date) as monthly_return_pct
        FROM portfolio_daily
        WHERE user_id = '${this.escapeString(userId)}'
        AND date BETWEEN '${fromDate}' AND '${toDate}'
        GROUP BY toLastDayOfMonth(date)
        ORDER BY month_eom
      `
    }

    return `
      SELECT 
        date,
        total_value,
        cash_balance,
        assets_value,
        daily_change,
        daily_return_pct,
        total_assets,
        total_positions
      FROM portfolio_daily
      WHERE user_id = '${this.escapeString(userId)}'
      AND date BETWEEN '${fromDate}' AND '${toDate}'
      ORDER BY date
    `
  }

  // Query para holdings atuais
  static buildCurrentHoldingsQuery(userId: string, date?: string): string {
    const targetDate = date || 'today()'
    
    return `
      SELECT 
        asset_id,
        dictGet('assets_dict', 'symbol', asset_id) as symbol,
        dictGet('assets_dict', 'class', asset_id) as class,
        sum(units) as units,
        argMax(current_price, date) as current_price,
        sum(market_value) as value,
        sum(unrealized_pnl) as unrealized_pnl,
        avg(unrealized_pnl_pct) as unrealized_pnl_pct
      FROM asset_positions
      WHERE user_id = '${this.escapeString(userId)}'
      AND date <= ${targetDate}
      GROUP BY asset_id
      HAVING units > 0.001
      ORDER BY value DESC
    `
  }

  // Query para breakdown por ativo
  static buildAssetBreakdownQuery(
    userId: string,
    fromDate: string,
    toDate: string
  ): string {
    return `
      SELECT 
        date,
        asset_id,
        dictGet('assets_dict', 'symbol', asset_id) as asset_symbol,
        dictGet('assets_dict', 'class', asset_id) as asset_class,
        sum(market_value) as value,
        (sum(market_value) / sumOver(sum(market_value)) OVER (PARTITION BY date)) * 100 as percentage,
        avg(volatility_30d) as volatility,
        avg(sharpe_30d) as sharpe_ratio,
        avg(max_drawdown_30d) as max_drawdown
      FROM asset_positions
      WHERE user_id = '${this.escapeString(userId)}'
      AND date BETWEEN '${fromDate}' AND '${toDate}'
      AND market_value > 1 -- Filtrar posições irrelevantes
      GROUP BY date, asset_id
      ORDER BY date, value DESC
    `
  }

  // Query para performance analysis
  static buildPerformanceAnalysisQuery(
    userId: string,
    fromDate: string,
    toDate: string
  ): string {
    return `
      WITH daily_values AS (
        SELECT 
          asset_id,
          date,
          sum(market_value) as value,
          dictGet('assets_dict', 'symbol', asset_id) as asset_symbol,
          dictGet('assets_dict', 'class', asset_id) as asset_class
        FROM asset_positions
        WHERE user_id = '${this.escapeString(userId)}'
        AND date BETWEEN '${fromDate}' AND '${toDate}'
        GROUP BY asset_id, date
      ),
      
      performance_metrics AS (
        SELECT 
          asset_id,
          asset_symbol,
          asset_class,
          
          -- Valores iniciais e finais
          argMin(value, date) as first_value,
          argMax(value, date) as last_value,
          
          -- Retorno total
          last_value - first_value as total_return,
          if(first_value > 0, (total_return / first_value) * 100, 0) as total_return_percent,
          
          -- Volatilidade (desvio padrão dos retornos diários)
          stddevPop(
            (value - lagInFrame(value, 1) OVER (PARTITION BY asset_id ORDER BY date)) / 
            lagInFrame(value, 1) OVER (PARTITION BY asset_id ORDER BY date)
          ) * sqrt(252) * 100 as volatility,
          
          -- Sharpe ratio simplificado
          if(volatility > 0, total_return_percent / volatility, 0) as sharpe_ratio,
          
          -- Contagem de pontos
          count() as data_points,
          
          -- Array de valores diários para drill-down
          groupArray((date, value)) as daily_values
          
        FROM daily_values
        GROUP BY asset_id, asset_symbol, asset_class
        HAVING data_points > 1
      )
      
      SELECT *
      FROM performance_metrics
      ORDER BY total_return DESC
    `
  }
}

// Verificação de saúde da conexão
export async function testClickHouseConnection(): Promise<boolean> {
  try {
    const result = await clickhouse.query({
      query: 'SELECT 1 as test',
    })
    
    const data = await result.json<{ test: number }>()
    return data[0]?.test === 1
  } catch (error) {
    console.error('ClickHouse connection failed:', error)
    return false
  }
}

// Utilitários para desenvolvimento
export const ClickHouseUtils = {
  helpers: ClickHouseHelpers,
  testConnection: testClickHouseConnection,
  client: clickhouse
}
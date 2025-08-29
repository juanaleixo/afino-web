#!/usr/bin/env tsx

/**
 * Script de verificação de saúde do ClickHouse
 * Testa conectividade, performance e integridade dos dados
 */

import { testClickHouseConnection, clickhouse } from '../src/lib/clickhouse'
import { performance } from 'perf_hooks'

interface HealthCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  duration?: number
  details?: string
  error?: string
}

async function runHealthCheck(name: string, checkFn: () => Promise<any>): Promise<HealthCheck> {
  const start = performance.now()
  
  try {
    const result = await checkFn()
    const duration = performance.now() - start
    
    return {
      name,
      status: 'pass',
      duration: Math.round(duration),
      details: typeof result === 'string' ? result : JSON.stringify(result)
    }
  } catch (error) {
    const duration = performance.now() - start
    
    return {
      name,
      status: 'fail',
      duration: Math.round(duration),
      error: (error as Error).message
    }
  }
}

async function main() {
  console.log('🏥 ClickHouse Health Check')
  console.log('========================')
  
  const checks: HealthCheck[] = []
  
  // 1. Conectividade básica
  checks.push(await runHealthCheck('Connectivity', async () => {
    const isHealthy = await testClickHouseConnection()
    if (!isHealthy) throw new Error('Connection failed')
    return 'Connected successfully'
  }))
  
  // 2. Verificar tabelas existem
  checks.push(await runHealthCheck('Tables Schema', async () => {
    const result = await clickhouse.query({
      query: `
        SELECT 
          name,
          engine,
          total_rows,
          total_bytes
        FROM system.tables 
        WHERE database = currentDatabase()
        AND name IN ('events_stream', 'portfolio_daily', 'asset_positions')
        ORDER BY name
      `
    })
    
    const tables = await result.json<{
      name: string;
      engine: string;
      total_rows: number;
      total_bytes: number;
    }>()
    
    const requiredTables = ['events_stream', 'portfolio_daily', 'asset_positions']
    const existingTables = tables.map(t => t.name)
    const missingTables = requiredTables.filter(t => !existingTables.includes(t))
    
    if (missingTables.length > 0) {
      throw new Error(`Missing tables: ${missingTables.join(', ')}`)
    }
    
    return `Found ${tables.length} tables with ${tables.reduce((sum, t) => sum + t.total_rows, 0)} total rows`
  }))
  
  // 3. Performance de query simples
  checks.push(await runHealthCheck('Query Performance', async () => {
    const result = await clickhouse.query({
      query: 'SELECT count() as total FROM events_stream'
    })
    
    const data = await result.json<{ total: number }>()
    return `Query returned ${data[0]?.total || 0} events`
  }))
  
  // 4. Teste de Materialized Views
  checks.push(await runHealthCheck('Materialized Views', async () => {
    const result = await clickhouse.query({
      query: `
        SELECT count() as mv_count 
        FROM system.tables 
        WHERE database = currentDatabase() 
        AND engine = 'MaterializedView'
      `
    })
    
    const data = await result.json<{ mv_count: number }>()
    const mvCount = data[0]?.mv_count || 0
    
    if (mvCount === 0) {
      throw new Error('No materialized views found')
    }
    
    return `${mvCount} materialized views active`
  }))
  
  // 5. Verificar Dictionary
  checks.push(await runHealthCheck('Asset Dictionary', async () => {
    const result = await clickhouse.query({
      query: `
        SELECT 
          dictGet('assets_dict', 'symbol', 'BRL') as brl_symbol,
          dictGet('assets_dict', 'class', 'BRL') as brl_class
      `
    })
    
    const data = await result.json<{ brl_symbol: string; brl_class: string }>()
    
    if (!data[0]?.brl_symbol) {
      throw new Error('Dictionary not loaded or missing data')
    }
    
    return `Dictionary loaded successfully (BRL: ${data[0].brl_symbol})`
  }))
  
  // 6. Verificar dados recentes
  checks.push(await runHealthCheck('Recent Data', async () => {
    const result = await clickhouse.query({
      query: `
        SELECT 
          max(date) as latest_date,
          count() as events_count
        FROM events_stream 
        WHERE date >= today() - 7
      `
    })
    
    const data = await result.json<{ latest_date: string; events_count: number }>()
    const latest = data[0]
    
    if (!latest?.events_count) {
      return 'No recent events found (last 7 days)'
    }
    
    return `${latest.events_count} events in last 7 days (latest: ${latest.latest_date})`
  }))
  
  // 7. Performance de query complexa
  checks.push(await runHealthCheck('Complex Query Performance', async () => {
    const result = await clickhouse.query({
      query: `
        SELECT 
          count(DISTINCT user_id) as users,
          count(DISTINCT asset_id) as assets,
          count() as total_events,
          avg(units_delta) as avg_units
        FROM events_stream 
        WHERE date >= today() - 30
        LIMIT 1
      `
    })
    
    const data = await result.json<{
      users: number;
      assets: number; 
      total_events: number;
      avg_units: number;
    }>()
    
    const stats = data[0]
    return `${stats?.users || 0} users, ${stats?.assets || 0} assets, ${stats?.total_events || 0} events (30d)`
  }))
  
  // Exibir resultados
  console.log('\nResults:')
  console.log('--------')
  
  let totalPassed = 0
  let totalFailed = 0
  let totalWarnings = 0
  
  for (const check of checks) {
    const statusIcon = {
      pass: '✅',
      fail: '❌', 
      warn: '⚠️'
    }[check.status]
    
    const durationStr = check.duration ? ` (${check.duration}ms)` : ''
    console.log(`${statusIcon} ${check.name}${durationStr}`)
    
    if (check.details) {
      console.log(`   ${check.details}`)
    }
    
    if (check.error) {
      console.log(`   Error: ${check.error}`)
    }
    
    if (check.status === 'pass') totalPassed++
    else if (check.status === 'fail') totalFailed++
    else totalWarnings++
  }
  
  // Resumo final
  console.log('\nSummary:')
  console.log('--------')
  console.log(`✅ Passed: ${totalPassed}`)
  if (totalWarnings > 0) console.log(`⚠️  Warnings: ${totalWarnings}`)
  if (totalFailed > 0) console.log(`❌ Failed: ${totalFailed}`)
  
  const overallStatus = totalFailed === 0 ? 
    (totalWarnings === 0 ? 'HEALTHY' : 'HEALTHY (with warnings)') : 
    'UNHEALTHY'
    
  console.log(`\nOverall Status: ${overallStatus}`)
  
  // Environment info
  console.log('\nEnvironment:')
  console.log('------------')
  console.log(`ClickHouse URL: ${process.env.NEXT_PUBLIC_CLICKHOUSE_URL || 'not set'}`)
  console.log(`ClickHouse User: ${process.env.NEXT_PUBLIC_CLICKHOUSE_USER || 'not set'}`)
  console.log(`ClickHouse DB: ${process.env.NEXT_PUBLIC_CLICKHOUSE_DATABASE || 'afino (default)'}`)
  
  // Exit code baseado no resultado
  if (totalFailed > 0) {
    process.exit(1)
  }
}

// Executar
main().catch(error => {
  console.error('💥 Health check failed:', error)
  process.exit(1)
})
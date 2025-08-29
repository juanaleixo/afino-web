#!/usr/bin/env tsx

/**
 * SCRIPT DE SYNC DE PREÇOS DIÁRIOS
 * 
 * Sincroniza preços de ativos para ClickHouse de forma batch
 * Pode ser executado via cron daily ou chamado via API
 * 
 * Usage:
 * - npm run sync:prices
 * - tsx scripts/sync-daily-prices.ts
 */

import { ClickHouseClient } from '@clickhouse/client'

// Configuração ClickHouse
const clickhouse = new ClickHouseClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DATABASE || 'afino'
})

// Configuração das APIs de preços (exemplo - adaptar conforme sua fonte)
const PRICE_APIS = {
  // Exemplo: Alpha Vantage, Yahoo Finance, etc.
  // Adapte conforme suas APIs reais
  stocks: 'https://api.example.com/stocks',
  crypto: 'https://api.example.com/crypto',
  forex: 'https://api.example.com/forex'
}

interface AssetPrice {
  asset_id: string
  date: string
  price: number
  open_price?: number
  high_price?: number
  low_price?: number
  volume?: number
  source: 'api' | 'manual' | 'calculated'
  currency: string
  confidence: number
}

// Buscar lista de ativos ativos (que têm posições recentes)
async function getActiveAssets(days: number = 30): Promise<string[]> {
  const query = `
    SELECT DISTINCT asset_id 
    FROM events_stream 
    WHERE date >= today() - ${days}
    AND units_delta != 0
  `
  
  const result = await clickhouse.query({
    query,
    format: 'JSONEachRow'
  })
  
  const rows = await result.json<{ asset_id: string }>()
  return rows.map(row => row.asset_id)
}

// Buscar preços via API externa (exemplo - substituir pela API real)
async function fetchPricesFromAPI(assetIds: string[], date: string): Promise<AssetPrice[]> {
  const prices: AssetPrice[] = []
  
  // Mock - substituir pela lógica real de busca de preços
  for (const assetId of assetIds) {
    try {
      // Exemplo: buscar preço do asset para a data específica
      // const response = await fetch(`${PRICE_APIS.stocks}/${assetId}?date=${date}`)
      // const data = await response.json()
      
      // Mock de preço para exemplo
      if (assetId === 'BRL') {
        // Moeda base sempre 1.0
        prices.push({
          asset_id: assetId,
          date,
          price: 1.0,
          source: 'calculated',
          currency: 'BRL',
          confidence: 1.0
        })
      } else if (assetId.startsWith('US')) {
        // Exemplo: ação americana
        prices.push({
          asset_id: assetId,
          date,
          price: Math.random() * 100 + 50, // Mock price
          open_price: Math.random() * 100 + 50,
          high_price: Math.random() * 100 + 60,
          low_price: Math.random() * 100 + 40,
          volume: Math.random() * 1000000,
          source: 'api',
          currency: 'USD',
          confidence: 0.95
        })
      } else {
        // Outros ativos
        prices.push({
          asset_id: assetId,
          date,
          price: Math.random() * 1000 + 10,
          source: 'api', 
          currency: 'BRL',
          confidence: 0.9
        })
      }
      
      console.log(`✓ Price fetched for ${assetId}: ${prices[prices.length - 1]?.price}`)
      
    } catch (error) {
      console.error(`✗ Failed to fetch price for ${assetId}:`, error)
      
      // Fallback: buscar último preço conhecido
      const lastKnownPrice = await getLastKnownPrice(assetId)
      if (lastKnownPrice) {
        prices.push({
          ...lastKnownPrice,
          date,
          source: 'calculated',
          confidence: 0.7
        })
        console.log(`↻ Using last known price for ${assetId}: ${lastKnownPrice.price}`)
      }
    }
  }
  
  return prices
}

// Buscar último preço conhecido do ClickHouse
async function getLastKnownPrice(assetId: string): Promise<AssetPrice | null> {
  const query = `
    SELECT 
      asset_id,
      price,
      open_price,
      high_price,
      low_price,
      volume,
      source,
      currency,
      confidence
    FROM daily_prices
    WHERE asset_id = '${assetId}'
    ORDER BY date DESC
    LIMIT 1
  `
  
  const result = await clickhouse.query({
    query,
    format: 'JSONEachRow'
  })
  
  const rows = await result.json<AssetPrice>()
  return rows[0] || null
}

// Inserir preços no ClickHouse
async function insertPrices(prices: AssetPrice[]): Promise<void> {
  if (prices.length === 0) {
    console.log('No prices to insert')
    return
  }
  
  const insertQuery = `
    INSERT INTO daily_prices (
      asset_id, date, price, open_price, high_price, low_price, 
      volume, source, currency, confidence, created_at, updated_at
    ) VALUES
  `
  
  const values = prices.map(p => `(
    '${p.asset_id}',
    '${p.date}',
    ${p.price},
    ${p.open_price || 'NULL'},
    ${p.high_price || 'NULL'},
    ${p.low_price || 'NULL'},
    ${p.volume || 'NULL'},
    '${p.source}',
    '${p.currency}',
    ${p.confidence},
    now(),
    now()
  )`).join(',\n')
  
  await clickhouse.exec({
    query: insertQuery + values
  })
  
  console.log(`✓ Inserted ${prices.length} prices into ClickHouse`)
}

// Função principal
async function syncDailyPrices(targetDate?: string) {
  const date = targetDate || new Date().toISOString().split('T')[0] // YYYY-MM-DD
  
  console.log(`\n🔄 Starting daily price sync for ${date}`)
  console.log('=' .repeat(50))
  
  try {
    // 1. Buscar ativos ativos
    console.log('📊 Fetching active assets...')
    const activeAssets = await getActiveAssets(30)
    console.log(`Found ${activeAssets.length} active assets`)
    
    if (activeAssets.length === 0) {
      console.log('No active assets found, skipping sync')
      return
    }
    
    // 2. Buscar preços via APIs
    console.log('\n💰 Fetching prices from APIs...')
    const prices = await fetchPricesFromAPI(activeAssets, date)
    console.log(`Fetched ${prices.length} prices`)
    
    // 3. Inserir no ClickHouse
    console.log('\n📥 Inserting prices into ClickHouse...')
    await insertPrices(prices)
    
    // 4. Verificar resultado
    const countQuery = `SELECT COUNT(*) as count FROM daily_prices WHERE date = '${date}'`
    const result = await clickhouse.query({
      query: countQuery,
      format: 'JSONEachRow'
    })
    const countResult = await result.json<{ count: string }>()
    
    console.log(`\n✅ Sync completed successfully!`)
    console.log(`Total prices in ClickHouse for ${date}: ${countResult[0]?.count || 0}`)
    
  } catch (error) {
    console.error('\n❌ Error during price sync:', error)
    process.exit(1)
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const targetDate = process.argv[2] // Opcional: tsx script.ts 2024-01-15
  syncDailyPrices(targetDate)
    .then(() => {
      console.log('\n🎉 Price sync finished')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Price sync failed:', error)
      process.exit(1)
    })
}

export { syncDailyPrices }
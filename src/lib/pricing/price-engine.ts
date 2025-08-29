import { clickhouse } from '../clickhouse'
import { supabase } from '../supabase'
import { cache, CacheTags } from '../cache'

// Sistema de preços otimizado para ClickHouse
export interface PriceSource {
  asset_id: string
  source: 'manual' | 'api' | 'event' | 'market'
  price: number
  currency: string
  timestamp: string
  confidence: number // 0-1, qualidade da fonte
}

export interface AssetPrice {
  asset_id: string
  symbol: string
  current_price: number
  price_date: string
  source: string
  last_updated: string
}

export class PriceEngine {
  // Cache de preços em memória (para performance crítica)
  private static priceCache = new Map<string, AssetPrice>()
  private static lastCacheUpdate = 0
  private static CACHE_TTL = 5 * 60 * 1000 // 5 minutos

  // Obter preço atual de um ativo (com cache agressivo)
  static async getCurrentPrice(assetId: string): Promise<number> {
    // 1. Cache em memória primeiro
    if (this.shouldUseCache()) {
      const cached = this.priceCache.get(assetId)
      if (cached) return cached.current_price
    }

    // 2. ClickHouse para preços recentes
    try {
      const price = await this.getPriceFromClickHouse(assetId)
      if (price) {
        this.priceCache.set(assetId, price)
        return price.current_price
      }
    } catch (error) {
      console.warn('ClickHouse price fetch failed:', error)
    }

    // 3. Fallback para Supabase
    const fallbackPrice = await this.getPriceFromSupabase(assetId)
    if (fallbackPrice) {
      this.priceCache.set(assetId, fallbackPrice)
      return fallbackPrice.current_price
    }

    // 4. Default: 1.0 para moedas, 0 para outros
    return this.getDefaultPrice(assetId)
  }

  // Buscar preços em lote (otimizado para ClickHouse)
  static async getBatchPrices(assetIds: string[]): Promise<Map<string, number>> {
    if (assetIds.length === 0) return new Map()

    try {
      const query = `
        SELECT 
          asset_id,
          dictGet('assets_dict', 'symbol', asset_id) as symbol,
          argMax(price, timestamp) as current_price,
          argMax(timestamp, timestamp) as price_date,
          argMax(source, timestamp) as source,
          now() as last_updated
        FROM asset_prices 
        WHERE asset_id IN (${assetIds.map(id => `'${id}'`).join(',')})
        AND timestamp >= now() - INTERVAL 1 DAY
        GROUP BY asset_id
        ORDER BY asset_id
      `

      const result = await clickhouse.query({ query })
      const prices = await result.json<AssetPrice[]>()

      const priceMap = new Map<string, number>()
      
      // Atualizar cache local e construir resultado
      for (const price of prices) {
        this.priceCache.set(price.asset_id, price)
        priceMap.set(price.asset_id, price.current_price)
      }

      // Preencher assets não encontrados com preço default
      for (const assetId of assetIds) {
        if (!priceMap.has(assetId)) {
          const defaultPrice = this.getDefaultPrice(assetId)
          priceMap.set(assetId, defaultPrice)
        }
      }

      return priceMap

    } catch (error) {
      console.error('Batch price fetch failed:', error)
      
      // Fallback: buscar individualmente
      const priceMap = new Map<string, number>()
      for (const assetId of assetIds) {
        priceMap.set(assetId, await this.getCurrentPrice(assetId))
      }
      return priceMap
    }
  }

  // Atualizar preço de ativo (admin ou API)
  static async updateAssetPrice(
    assetId: string, 
    newPrice: number, 
    source: PriceSource['source'] = 'manual',
    confidence = 1.0
  ) {
    const timestamp = new Date().toISOString()
    
    try {
      // 1. Inserir no ClickHouse
      await clickhouse.insert('asset_prices', [{
        asset_id: assetId,
        source,
        price: newPrice,
        currency: 'BRL', // TODO: detectar automaticamente
        timestamp,
        confidence
      }])

      // 2. Atualizar cache local
      this.priceCache.set(assetId, {
        asset_id: assetId,
        symbol: assetId, // TODO: buscar símbolo real
        current_price: newPrice,
        price_date: timestamp,
        source,
        last_updated: timestamp
      })

      // 3. Invalidar cache de portfolio (preços afetam cálculos)
      cache.invalidateTags([CacheTags.ASSETS])

      console.log(`Price updated: ${assetId} = ${newPrice} (${source})`)
      
    } catch (error) {
      console.error('Failed to update asset price:', error)
      throw new Error('Erro ao atualizar preço do ativo')
    }
  }

  // Sincronização com APIs externas
  static async syncExternalPrices() {
    try {
      // 1. Buscar ativos que precisam de atualização
      const { data: assets } = await supabase
        .from('global_assets')
        .select('id, symbol, connector, class')
        .not('connector', 'is', null)
        .eq('class', 'stock') // Focar em ações primeiro

      if (!assets?.length) return

      // 2. Agrupar por connector para otimizar API calls
      const byConnector = new Map<string, typeof assets>()
      for (const asset of assets) {
        const connector = asset.connector || 'manual'
        if (!byConnector.has(connector)) byConnector.set(connector, [])
        byConnector.get(connector)!.push(asset)
      }

      // 3. Processar cada connector
      for (const [connector, connectorAssets] of byConnector) {
        await this.syncConnectorPrices(connector, connectorAssets)
      }

      console.log(`External price sync completed: ${assets.length} assets`)

    } catch (error) {
      console.error('External price sync failed:', error)
    }
  }

  // Conectores específicos para APIs
  private static async syncConnectorPrices(connector: string, assets: any[]) {
    switch (connector) {
      case 'alpha_vantage':
        return await this.syncAlphaVantage(assets)
      case 'yahoo_finance':
        return await this.syncYahooFinance(assets)
      case 'b3_api':
        return await this.syncB3Api(assets)
      default:
        console.warn(`Unknown connector: ${connector}`)
    }
  }

  // Alpha Vantage API (para ações americanas)
  private static async syncAlphaVantage(assets: any[]) {
    const apiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY
    if (!apiKey) return

    for (const asset of assets) {
      try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${asset.symbol}&apikey=${apiKey}`
        const response = await fetch(url)
        const data = await response.json()

        const price = parseFloat(data['Global Quote']?.['05. price'])
        if (price && price > 0) {
          await this.updateAssetPrice(asset.id, price, 'api', 0.9)
          await new Promise(resolve => setTimeout(resolve, 200)) // Rate limit
        }
      } catch (error) {
        console.error(`Failed to sync ${asset.symbol} from Alpha Vantage:`, error)
      }
    }
  }

  // Yahoo Finance API (para ações brasileiras)
  private static async syncYahooFinance(assets: any[]) {
    // Implementar sincronização com Yahoo Finance
    // Usar batch request para otimizar
    console.log('Yahoo Finance sync not implemented yet')
  }

  // B3 API (para ações brasileiras - oficial)
  private static async syncB3Api(assets: any[]) {
    // Implementar sincronização com API da B3
    console.log('B3 API sync not implemented yet')
  }

  // Helpers privados
  private static async getPriceFromClickHouse(assetId: string): Promise<AssetPrice | null> {
    const query = `
      SELECT 
        asset_id,
        dictGet('assets_dict', 'symbol', asset_id) as symbol,
        argMax(price, timestamp) as current_price,
        argMax(timestamp, timestamp) as price_date,
        argMax(source, timestamp) as source,
        now() as last_updated
      FROM asset_prices
      WHERE asset_id = '${assetId}'
      AND timestamp >= now() - INTERVAL 7 DAY
      GROUP BY asset_id
      LIMIT 1
    `

    const result = await clickhouse.query({ query })
    const data = await result.json<AssetPrice[]>()
    return data[0] || null
  }

  private static async getPriceFromSupabase(assetId: string): Promise<AssetPrice | null> {
    const { data } = await supabase
      .from('global_assets')
      .select('id, symbol, manual_price')
      .eq('id', assetId)
      .single()

    if (!data?.manual_price) return null

    return {
      asset_id: data.id,
      symbol: data.symbol,
      current_price: data.manual_price,
      price_date: new Date().toISOString(),
      source: 'manual',
      last_updated: new Date().toISOString()
    }
  }

  private static getDefaultPrice(assetId: string): number {
    // Moedas têm valor padrão 1.0
    if (['BRL', 'USD', 'EUR'].includes(assetId)) return 1.0
    
    // Outros ativos: 0 (precisam de preço manual)
    return 0
  }

  private static shouldUseCache(): boolean {
    return Date.now() - this.lastCacheUpdate < this.CACHE_TTL
  }
}

// Background job para sincronização automática (executar a cada 15 minutos)
if (typeof window === 'undefined') {
  const SYNC_INTERVAL = 15 * 60 * 1000 // 15 minutos
  
  setInterval(() => {
    PriceEngine.syncExternalPrices().catch(error => {
      console.error('Background price sync failed:', error)
    })
  }, SYNC_INTERVAL)
}
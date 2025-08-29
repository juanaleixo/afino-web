import { supabase, PortfolioDaily, PortfolioMonthly, HoldingAt, HoldingAccount } from './supabase'
import { clickhouse, ClickHouseHelpers, type PortfolioDailyRecord, type AssetPositionRecord } from './clickhouse'
import { PriceEngine } from './pricing/price-engine'
import { withCache } from './cache'

// Serviço híbrido para portfolio: Supabase (transações) + ClickHouse (analytics)
export class HybridPortfolioService {
  private userId: string
  private userPlan: 'free' | 'premium' = 'free'

  constructor(userId: string, options?: { assumedPlan?: 'free' | 'premium' }) {
    this.userId = userId
    if (options?.assumedPlan) this.userPlan = options.assumedPlan
  }

  // Cached function to get user plan
  private getUserPlan = withCache(
    async (userId: string) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('plan')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.warn('Erro ao carregar plano do usuário, mantendo plano atual:', error)
        return 'free'
      }
      
      return data?.plan || 'free'
    },
    (userId: string) => `user_plan:${userId}`,
    { ttl: 10 * 60 * 1000 } // 10 minutes
  )

  // Inicializar o plano do usuário
  async initialize() {
    try {
      const plan = await this.getUserPlan(this.userId)
      if (plan === 'premium') {
        this.userPlan = 'premium'
      } else if (!this.userPlan || this.userPlan === 'free') {
        this.userPlan = plan
      }
    } catch (error) {
      console.warn('Erro ao verificar plano do usuário, mantendo plano atual:', error)
    }
  }

  // Cached function for asset batch lookup
  private getAssetsBatch = withCache(
    async (assetIds: string[]) => {
      if (assetIds.length === 0) return []
      
      const { data, error } = await supabase
        .from('global_assets')
        .select('id, symbol, class, label_ptbr')
        .in('id', assetIds)
      
      if (error) {
        console.warn('Erro ao buscar ativos:', error)
        return []
      }
      
      return data || []
    },
    (assetIds: string[]) => `assets_batch:${assetIds.sort().join(',')}`,
    { ttl: 15 * 60 * 1000 } // 15 minutes (assets change infrequently)
  )

  // Verificar se o usuário tem acesso premium
  private checkPremiumAccess(feature: string) {
    if (this.userPlan !== 'premium') {
      throw new Error(`Funcionalidade ${feature} requer plano premium`)
    }
  }

  // Série diária do patrimônio via ClickHouse (premium)
  async getDailySeries(from: string, to: string): Promise<PortfolioDaily[]> {
    this.checkPremiumAccess('série diária')
    
    try {
      const query = ClickHouseHelpers.buildPortfolioDailyQuery(this.userId, from, to, 'daily')
      const result = await clickhouse.query({ query })
      const data = await result.json<PortfolioDailyRecord[]>()
      
      return data.map(row => ({
        date: row.date,
        total_value: row.total_value
      }))
      
    } catch (error) {
      console.error('ClickHouse daily series failed:', error)
      // Fallback para método antigo se ClickHouse falhar
      return await this.getDailySeriesFallback(from, to)
    }
  }
  
  // Método fallback para compatibilidade
  private async getDailySeriesFallback(from: string, to: string): Promise<PortfolioDaily[]> {
    console.warn('Using Supabase fallback for daily series')
    const { data: rows, error } = await supabase
      .from('daily_positions_acct')
      .select('date, value, user_id, is_final')
      .eq('user_id', this.userId)
      .gte('date', from)
      .lte('date', to)
      .eq('is_final', true)
      .order('date')
    
    if (error) throw new Error('Erro ao carregar dados diários do portfólio')
    
    const map = new Map<string, number>()
    for (const r of rows || []) {
      const d = r.date as string
      const v = Number((r as any).value) || 0
      map.set(d, (map.get(d) || 0) + v)
    }
    
    return Array.from(map.entries())
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total_value: total }))
  }

  // Série mensal do patrimônio via ClickHouse (free/premium)
  async getMonthlySeries(from: string, to: string): Promise<PortfolioMonthly[]> {
    try {
      const query = ClickHouseHelpers.buildPortfolioDailyQuery(this.userId, from, to, 'monthly')
      const result = await clickhouse.query({ query })
      const data = await result.json<{ month_eom: string; total_value: number; monthly_change: number; monthly_return_pct: number }[]>()
      
      return data.map(row => ({
        month_eom: row.month_eom,
        total_value: row.total_value
      }))
      
    } catch (error) {
      console.error('ClickHouse monthly series failed:', error)
      // Fallback para método antigo
      return await this.getMonthlySeriesFallback(from, to)
    }
  }
  
  // Método fallback para compatibilidade
  private async getMonthlySeriesFallback(from: string, to: string): Promise<PortfolioMonthly[]> {
    console.warn('Using Supabase fallback for monthly series')
    const { data: rows, error } = await supabase
      .from('daily_positions_acct')
      .select('date, value, user_id, is_final')
      .eq('user_id', this.userId)
      .eq('is_final', true)
      .gte('date', from)
      .lte('date', to)
      .order('date')
    
    if (error) return []

    const totalsByDate = new Map<string, number>()
    for (const r of rows || []) {
      const d = (r as any).date as string
      const v = Number((r as any).value) || 0
      totalsByDate.set(d, (totalsByDate.get(d) || 0) + v)
    }
    
    if (totalsByDate.size === 0) return []

    const byMonth = new Map<string, { date: string, total: number }>()
    const dates = Array.from(totalsByDate.keys()).sort((a,b)=> a.localeCompare(b))
    for (const d of dates) {
      const m = new Date(d)
      const monthKey = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1)).toISOString().slice(0,10)
      const current = byMonth.get(monthKey)
      const total = totalsByDate.get(d) || 0
      if (!current || d > current.date) byMonth.set(monthKey, { date: d, total })
    }

    return Array.from(byMonth.entries())
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([month, obj]) => ({ month_eom: month, total_value: obj.total }))
  }

  // Cached function for optimized holdings with assets
  private getHoldingsWithAssets = withCache(
    async (userId: string, date: string) => {
      // Try new optimized function first, fallback to original on 404
      try {
        const { data, error } = await supabase.rpc('api_holdings_with_assets', { 
          p_date: date
        })
        if (!error && Array.isArray(data)) return data
      } catch {
        // Function doesn't exist yet, ignore and fallback
      }
      
      // Fallback to original RPC
      const { data: fallbackData, error: fallbackError } = await supabase.rpc('api_holdings_at', { 
        p_date: date
      })
      if (!fallbackError && Array.isArray(fallbackData)) return fallbackData
      
      throw new Error(`RPC failed: ${fallbackError?.message || 'Unknown error'}`)
    },
    (userId: string, date: string) => `holdings_with_assets:${userId}:${date}`,
    { ttl: 2 * 60 * 1000 } // 2 minutes
  )

  // Snapshot por ativo via ClickHouse (free/premium) 
  async getHoldingsAt(date: string): Promise<HoldingAt[]> {
    try {
      const query = ClickHouseHelpers.buildCurrentHoldingsQuery(this.userId, `'${date}'`)
      const result = await clickhouse.query({ query })
      const data = await result.json<{
        asset_id: string;
        symbol: string;
        class: string;
        units: number;
        current_price: number;
        value: number;
        unrealized_pnl: number;
        unrealized_pnl_pct: number;
      }[]>()
      
      return data.map(row => ({
        asset_id: row.asset_id,
        units: row.units,
        value: row.value,
        symbol: row.symbol,
        class: row.class
      }))
      
    } catch (error) {
      console.error('ClickHouse holdings failed:', error)
      // Fallback para método antigo
      return await this.getHoldingsAtFallback(date)
    }
  }
  
  // Método fallback para compatibilidade
  private async getHoldingsAtFallback(date: string): Promise<HoldingAt[]> {
    console.warn('Using Supabase fallback for holdings')
    let targetDate = date
    
    try {
      const { data: lastRow } = await supabase
        .from('daily_positions_acct')
        .select('date, user_id')
        .eq('user_id', this.userId)
        .lte('date', date)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (lastRow?.date) targetDate = (lastRow as any).date
    } catch (e) {
      console.warn('Falha ao buscar última data disponível, usando data solicitada:', e)
    }

    const { data: rows, error } = await supabase
      .from('daily_positions_acct')
      .select('asset_id, units, value, user_id, is_final')
      .eq('user_id', this.userId)
      .eq('date', targetDate)
      .eq('is_final', true)
    
    if (error) throw new Error('Erro ao carregar posições do portfólio')
    
    const agg = new Map<string, { units: number, value: number }>()
    for (const r of rows || []) {
      const id = (r as any).asset_id as string
      const u = Number((r as any).units) || 0
      const v = Number((r as any).value) || 0
      const prev = agg.get(id) || { units: 0, value: 0 }
      agg.set(id, { units: prev.units + u, value: prev.value + v })
    }
    
    if (agg.size === 0) return []
    
    const assetIds = Array.from(agg.keys())
    const assetsData = await this.getAssetsBatch(assetIds)
    const assetMap = new Map<string, { symbol?: string, class?: string }>()
    for (const a of assetsData) assetMap.set(a.id, { symbol: a.symbol, class: a.class })
    
    const result: any[] = []
    for (const [asset_id, { units, value }] of agg.entries()) {
      const meta = assetMap.get(asset_id) || {}
      result.push({ asset_id, units, value, symbol: meta.symbol, class: meta.class })
    }
    return result
  }

  // Snapshot por conta+ativo (premium)
  async getHoldingsAccounts(date: string): Promise<HoldingAccount[]> {
    this.checkPremiumAccess('detalhamento por conta')
    
    const { data, error } = await supabase.rpc('api_holdings_accounts', {
      p_date: date
    })

    if (error) {
      console.error('Erro ao carregar holdings por conta:', error)
      throw new Error('Erro ao carregar posições detalhadas do portfólio')
    }

    return data || []
  }

  // Obter dados do portfólio baseado no plano
  async getPortfolioData(dateRange: { from: string; to: string }, date: string) {
    await this.initialize()

    const [monthlySeries, holdingsAt] = await Promise.all([
      this.getMonthlySeries(dateRange.from, dateRange.to),
      this.getHoldingsAt(date)
    ])

    const result = {
      monthlySeries,
      holdingsAt,
      dailySeries: null as PortfolioDaily[] | null,
      holdingsAccounts: null as HoldingAccount[] | null
    }

    // Adicionar dados premium se disponível
    if (this.userPlan === 'premium') {
      try {
        const [dailySeries, holdingsAccounts] = await Promise.all([
          this.getDailySeries(dateRange.from, dateRange.to),
          this.getHoldingsAccounts(date)
        ])
        
        result.dailySeries = dailySeries
        result.holdingsAccounts = holdingsAccounts
      } catch (error) {
        console.warn('Erro ao carregar dados premium:', error)
      }
    }

    return result
  }

  // Carregar contas do usuário (real)
  async getAccounts() {
    const { data, error } = await supabase
      .from('accounts')
      .select('id, label')
      .eq('user_id', this.userId)
      .order('created_at')

    if (error) {
      console.error('Erro ao carregar contas:', error)
      throw new Error('Erro ao carregar contas do usuário')
    }

    return data || []
  }

  // Carregar ativos únicos dos holdings (real)
  async getUniqueAssets(date: string) {
    // Tentar primeiro a função detalhada
    try {
      const { data, error } = await supabase.rpc('api_holdings_detailed_at', {
        p_date: date
      })

      if (!error && data && data.length > 0) {
        return data.map((holding: any) => ({
          id: holding.asset_id,
          symbol: holding.symbol,
          class: holding.class,
          label: holding.label_ptbr || holding.symbol
        }))
      }
    } catch {
      console.warn('RPC api_holdings_detailed_at não disponível, usando fallback')
    }

    // Fallback 1: daily_positions_acct do dia
    try {
      const { data: rows, error } = await supabase
        .from('daily_positions_acct')
        .select('asset_id')
        .eq('date', date)
      if (!error && rows) {
        const ids = Array.from(new Set(rows.map((r: any) => r.asset_id)))
        if (ids.length) {
          const { data: ga } = await supabase
            .from('global_assets')
            .select('id, symbol, class, label_ptbr')
            .in('id', ids)
          const map = new Map<string, any>((ga || []).map((a: any) => [a.id, a]))
          return ids.map(id => ({ 
            id, 
            symbol: map.get(id)?.symbol || id, 
            class: map.get(id)?.class || 'unknown',
            label: map.get(id)?.label_ptbr || map.get(id)?.symbol || id
          }))
        }
      }
    } catch (e) {
      console.warn('Fallback unique assets via daily_positions falhou, tentando eventos:', e)
    }
    // Fallback 2: eventos
    try {
      const { data, error } = await supabase
        .from('events')
        .select('asset_id, global_assets(symbol, class, label_ptbr)')
        .eq('user_id', this.userId)
        .not('global_assets', 'is', null)
      if (error) throw error
      const uniqueAssets = data?.reduce((acc: any[], item: any) => {
        const asset = {
          id: item.asset_id,
          symbol: item.global_assets?.symbol || item.asset_id,
          class: item.global_assets?.class || 'unknown',
          label: item.global_assets?.label_ptbr || item.global_assets?.symbol || item.asset_id
        }
        if (!acc.find(a => a.id === asset.id)) acc.push(asset)
        return acc
      }, []) || []
      return uniqueAssets
    } catch (e) {
      console.error('Erro ao carregar ativos únicos via eventos:', e)
      return []
    }
  }

  // Obter breakdown por ativo via ClickHouse (Premium)
  async getAssetBreakdown(from: string, to: string) {
    this.checkPremiumAccess('breakdown por ativo')

    try {
      const query = ClickHouseHelpers.buildAssetBreakdownQuery(this.userId, from, to)
      const result = await clickhouse.query({ query })
      const data = await result.json<{
        date: string;
        asset_id: string;
        asset_symbol: string;
        asset_class: string;
        value: number;
        percentage: number;
        volatility: number;
        sharpe_ratio: number;
        max_drawdown: number;
      }[]>()
      
      return data.map(row => ({
        date: row.date,
        asset_id: row.asset_id,
        asset_symbol: row.asset_symbol,
        asset_class: row.asset_class,
        value: row.value,
        percentage: row.percentage
      }))
      
    } catch (error) {
      console.error('ClickHouse asset breakdown failed:', error)
      // Fallback usando holdings atuais
      return await this.getAssetBreakdownFallback(from, to)
    }
  }
  
  // Método fallback para compatibilidade
  private async getAssetBreakdownFallback(from: string, to: string) {
    console.warn('Using fallback for asset breakdown')
    const holdings = await this.getHoldingsAt(to)
    if (!holdings || holdings.length === 0) return []

    const totalValue = holdings.reduce((sum: number, h: any) => sum + (h.value || 0), 0)

    return holdings
      .filter((h: any) => (h.value || 0) > 0.01)
      .map((holding: any) => ({
        date: to,
        asset_id: holding.asset_id,
        asset_symbol: holding.symbol || holding.asset_id,
        asset_class: holding.class || 'unknown',
        value: holding.value || 0,
        percentage: totalValue > 0 ? ((holding.value || 0) / totalValue) * 100 : 0,
      }))
  }

  // Obter dados por conta (Premium) - dados reais  
  async getPortfolioByAccounts(from: string, to: string) {
    this.checkPremiumAccess('dados por conta')
    
    const { data, error } = await supabase.rpc('api_portfolio_daily_accounts', {
      p_from: from,
      p_to: to
    })

    if (error) {
      console.error('Erro ao carregar dados por conta:', error)
      throw new Error('Erro ao carregar evolução por conta')
    }

    return data || []
  }

  // Obter posições diárias por ativo específico (Premium) - NOVO
  async getDailyPositionsByAsset(assetId: string, from: string, to: string) {
    this.checkPremiumAccess('posições diárias por ativo')
    // Tenta RPC
    try {
      const { data, error } = await supabase.rpc('api_positions_daily_by_asset', {
        p_asset: assetId,
        p_from: from,
        p_to: to
      })
      if (!error && Array.isArray(data)) {
        return data.map((r: any) => ({
          date: r.date || r.d || r.day || r.month_eom || r.tstamp?.slice?.(0, 10) || '',
          units: Number(r.units ?? r.qty ?? r.quantity ?? 0),
          value: Number(r.value ?? r.total_value ?? r.market_value ?? r.asset_value ?? 0)
        }))
      }
    } catch (e) {
      console.warn('Falha RPC positions_by_asset, fallback via tabela:', e)
    }
    // Fallback: tabela daily_positions_acct agregada por data
    const { data: rows, error } = await supabase
      .from('daily_positions_acct')
      .select('date, units, value, asset_id, user_id, is_final')
      .eq('user_id', this.userId)
      .eq('asset_id', assetId)
      .gte('date', from)
      .lte('date', to)
      .eq('is_final', true)
      .order('date')
    if (error) {
      console.error('Erro fallback positions_by_asset via tabela:', error)
      throw new Error('Erro ao carregar evolução do ativo')
    }
    const map = new Map<string, { units: number, value: number }>()
    for (const r of rows || []) {
      const d = (r as any).date as string
      const u = Number((r as any).units) || 0
      const v = Number((r as any).value) || 0
      const prev = map.get(d) || { units: 0, value: 0 }
      map.set(d, { units: prev.units + u, value: prev.value + v })
    }
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([date, o]) => ({ date, units: o.units, value: o.value }))
  }

  // Obter posições diárias por conta e ativo específico (Premium) - NOVO
  async getDailyPositionsByAccountAsset(accountId: string, assetId: string, from: string, to: string) {
    this.checkPremiumAccess('posições detalhadas por conta/ativo')
    // Tenta RPC
    try {
      const { data, error } = await supabase.rpc('api_positions_daily_by_account', {
        p_account: accountId,
        p_asset: assetId,
        p_from: from,
        p_to: to
      })
      if (!error && Array.isArray(data)) {
        return data.map((r: any) => ({
          date: r.date || r.d || r.day || r.month_eom || r.tstamp?.slice?.(0, 10) || '',
          units: Number(r.units ?? r.qty ?? r.quantity ?? 0),
          value: Number(r.value ?? r.total_value ?? r.market_value ?? r.asset_value ?? 0)
        }))
      }
    } catch (e) {
      console.warn('Falha RPC positions_by_account, fallback via tabela:', e)
    }
    // Fallback: tabela daily_positions_acct
    const { data: rows, error } = await supabase
      .from('daily_positions_acct')
      .select('date, units, value, account_id, asset_id, user_id, is_final')
      .eq('user_id', this.userId)
      .eq('asset_id', assetId)
      .eq('account_id', accountId)
      .gte('date', from)
      .lte('date', to)
      .eq('is_final', true)
      .order('date')
    if (error) {
      console.error('Erro fallback positions_by_account via tabela:', error)
      throw new Error('Erro ao carregar evolução detalhada')
    }
    return (rows || []).map((r: any) => ({
      date: r.date,
      units: Number(r.units) || 0,
      value: Number(r.value) || 0,
    }))
  }

  // Análise avançada de performance via ClickHouse (Premium)
  async getAssetPerformanceAnalysis(from: string, to: string) {
    this.checkPremiumAccess('análise de performance')

    try {
      const query = ClickHouseHelpers.buildPerformanceAnalysisQuery(this.userId, from, to)
      const result = await clickhouse.query({ query })
      const data = await result.json<{
        asset_id: string;
        asset_symbol: string;
        asset_class: string;
        first_value: number;
        last_value: number;
        total_return: number;
        total_return_percent: number;
        volatility: number;
        sharpe_ratio: number;
        data_points: number;
        daily_values: Array<[string, number]>;
      }[]>()
      
      return data.map(row => ({
        asset_id: row.asset_id,
        asset_symbol: row.asset_symbol,
        asset_class: row.asset_class,
        firstValue: row.first_value,
        lastValue: row.last_value,
        totalReturn: row.total_return,
        totalReturnPercent: row.total_return_percent,
        volatility: row.volatility,
        sharpeRatio: row.sharpe_ratio,
        dataPoints: row.data_points,
        daily_values: row.daily_values.map(([date, value]) => ({ date, value }))
      }))
      
    } catch (error) {
      console.error('ClickHouse performance analysis failed:', error)
      // Fallback para cálculo manual
      return await this.getAssetPerformanceAnalysisFallback(from, to)
    }
  }
  
  // Método fallback para cálculos manuais
  private async getAssetPerformanceAnalysisFallback(from: string, to: string) {
    console.warn('Using manual calculation for performance analysis')
    const breakdown = await this.getAssetBreakdown(from, to)
    if (!breakdown || breakdown.length === 0) return []

    const assetGroups = breakdown.reduce((acc: any, item: any) => {
      if (!acc[item.asset_id]) {
        acc[item.asset_id] = {
          asset_id: item.asset_id,
          asset_symbol: item.asset_symbol,
          asset_class: item.asset_class,
          daily_values: []
        }
      }
      acc[item.asset_id].daily_values.push({
        date: item.date,
        value: (item as any).value ?? (item as any).asset_value ?? 0
      })
      return acc
    }, {})

    return Object.values(assetGroups).map((asset: any) => {
      const values = asset.daily_values.sort((a: any, b: any) => a.date.localeCompare(b.date))
      const firstValue = values[0]?.value || 0
      const lastValue = values[values.length - 1]?.value || 0
      const totalReturn = lastValue - firstValue
      const totalReturnPercent = firstValue > 0 ? (totalReturn / firstValue) * 100 : 0
      
      const dailyReturns = []
      for (let i = 1; i < values.length; i++) {
        const prevValue = values[i - 1].value
        const currValue = values[i].value
        const dailyReturn = prevValue > 0 ? (currValue - prevValue) / prevValue : 0
        dailyReturns.push(dailyReturn)
      }
      
      const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length
      const volatility = Math.sqrt(
        dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length
      ) * Math.sqrt(252) * 100

      return {
        ...asset,
        firstValue,
        lastValue,
        totalReturn,
        totalReturnPercent,
        volatility,
        sharpeRatio: volatility > 0 ? (totalReturnPercent / volatility) : 0,
        dataPoints: values.length
      }
    })
  }

  // Obter estatísticas do portfólio
  async getPortfolioStats(date: string) {
    const holdings = await this.getHoldingsAt(date)
    
    const totalValue = holdings.reduce((sum, holding) => sum + Number((holding as any).value || 0), 0)
    const totalAssets = holdings.length
    
    return {
      totalValue,
      totalAssets,
      holdings
    }
  }

  // Obter lista de ativos do usuário com símbolos
  async getUserAssets() {
    try {
      // First get user's holdings to find which assets they have
      const holdings = await this.getHoldingsAt(new Date().toISOString().split('T')[0]!)
      const assetIds = holdings.map(h => h.asset_id)
      
      if (assetIds.length === 0) return []
      
      // Then get asset details from global_assets table
      const { data, error } = await supabase
        .from('global_assets')
        .select('id, symbol, class, label_ptbr')
        .in('id', assetIds)
      
      if (error) throw error
      
      return data?.map(asset => ({
        id: asset.id,
        symbol: asset.symbol || asset.id,
        class: asset.class || 'unknown',
        label: asset.label_ptbr || asset.symbol || asset.id
      })) || []
    } catch (error) {
      console.error('Erro ao carregar ativos do usuário:', error)
      return []
    }
  }
}

// Singleton instances cache
const serviceInstances = new Map<string, HybridPortfolioService>()

// Factory function to get or create HybridPortfolioService instance
export function getPortfolioService(userId: string, options?: { assumedPlan?: 'free' | 'premium' }): HybridPortfolioService {
  const cacheKey = `${userId}_${options?.assumedPlan || 'auto'}`
  
  if (!serviceInstances.has(cacheKey)) {
    console.log(`Creating new HybridPortfolioService instance for ${cacheKey}`)
    serviceInstances.set(cacheKey, new HybridPortfolioService(userId, options))
  } else {
    console.log(`Reusing HybridPortfolioService instance for ${cacheKey}`)
  }
  
  return serviceInstances.get(cacheKey)!
}

// Hook para usar o serviço de portfólio
export const usePortfolioService = (userId: string) => {
  const service = getPortfolioService(userId)
  
  return {
    service,
    getPortfolioData: (dateRange: { from: string; to: string }, date: string) => 
      service.getPortfolioData(dateRange, date),
    getPortfolioStats: (date: string) => service.getPortfolioStats(date),
    getDailySeries: (from: string, to: string) => service.getDailySeries(from, to),
    getMonthlySeries: (from: string, to: string) => service.getMonthlySeries(from, to),
    getHoldingsAt: (date: string) => service.getHoldingsAt(date),
    getHoldingsAccounts: (date: string) => service.getHoldingsAccounts(date),
    getUserAssets: () => service.getUserAssets()
  }
} 

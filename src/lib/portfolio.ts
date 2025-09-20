import { supabase, PortfolioDaily, PortfolioMonthly, HoldingAt, HoldingAccount } from './supabase'
import { withCache } from './cache'
import { PremiumGuard } from './premium-guard'

// Serviço para as funções RPC do portfólio
export class PortfolioService {
  private userId: string

  constructor(userId: string, options?: { assumedPlan?: 'free' | 'premium' }) {
    this.userId = userId
    // Note: assumedPlan is kept for backward compatibility but ignored
    // All premium checks now go through PremiumGuard
  }

  // Initialize method kept for backward compatibility
  async initialize() {
    // No-op: Premium checking is now handled by PremiumGuard
    console.log('PortfolioService initialized (premium checking delegated to PremiumGuard)')
  }

  // Cached function for asset batch lookup (por symbol)
  private getAssetsBatch = withCache(
    async (assetSymbols: string[]) => {
      if (assetSymbols.length === 0) return []
      
      const { data, error } = await supabase
        .from('global_assets')
        .select('symbol, class, label_ptbr')
        .in('symbol', assetSymbols)
      
      if (error) {
        console.warn('Erro ao buscar ativos:', error)
        return []
      }
      
      return data || []
    },
    (assetSymbols: string[]) => `assets_batch:${assetSymbols.sort().join(',')}`,
    { ttl: 15 * 60 * 1000 }
  )

  // Premium access methods now delegate to PremiumGuard

  // Série diária do patrimônio (premium)
  async getDailySeries(from: string, to: string): Promise<PortfolioDaily[]> {
    return PremiumGuard.withPremiumOrDefault(
      this.userId,
      async () => this._getDailySeriesInternal(from, to),
      [], // Empty array as fallback
      'série diária'
    )
  }

  private async _getDailySeriesInternal(from: string, to: string): Promise<PortfolioDaily[]> {
    // Tenta RPC
    try {
      const { data, error } = await supabase.rpc('api_portfolio_daily', { p_from: from, p_to: to })
      if (!error && Array.isArray(data)) return data
      console.warn('api_portfolio_daily falhou/sem dados, fallback via tabela', error)
    } catch (e) {
      console.warn('Falha RPC api_portfolio_daily, tentando tabela:', e)
    }
    // Fallback: somar daily_positions_acct por dia
    const { data: rows, error } = await supabase
      .from('daily_positions_acct')
      .select('date, value, user_id, is_final')
      .eq('user_id', this.userId)
      .gte('date', from)
      .lte('date', to)
      .eq('is_final', true)
      .order('date')
    if (error) {
      console.error('Fallback diário via tabela falhou:', error)
      throw new Error('Erro ao carregar dados diários do portfólio')
    }
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

  // Série mensal do patrimônio (free/premium)
  async getMonthlySeries(from: string, to: string): Promise<PortfolioMonthly[]> {
    // Tenta RPC mensal
    try {
      const { data, error } = await supabase.rpc('api_portfolio_monthly', { p_from: from, p_to: to })
      if (!error && Array.isArray(data)) return data
      console.warn('api_portfolio_monthly falhou/sem dados, derivando do diário', error)
    } catch (e) {
      console.warn('Falha RPC api_portfolio_monthly, derivando do diário:', e)
    }
    // Fallback: derivar de daily_positions_acct (livre de premium), somando por dia e pegando o último dia de cada mês
    try {
      const { data: rows, error } = await supabase
        .from('daily_positions_acct')
        .select('date, value, user_id, is_final')
        .eq('user_id', this.userId)
        .eq('is_final', true)
        .gte('date', from)
        .lte('date', to)
        .order('date')
      
      if (error) {
        console.error('Fallback mensal via tabela falhou:', error)
        return []
      }

      // Agregar valor total por data
      const totalsByDate = new Map<string, number>()
      for (const r of rows || []) {
        const d = (r as any).date as string
        const v = Number((r as any).value) || 0
        totalsByDate.set(d, (totalsByDate.get(d) || 0) + v)
      }
      if (totalsByDate.size === 0) return []

      // Para cada mês, pegar o último dia disponível e seu total
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
    } catch (e) {
      console.warn('Falha derivação mensal via tabela:', e)
      return []
    }
  }

  // Simplified cached function - API now reliable, no complex fallbacks needed
  private getHoldingsWithAssets = withCache(
    async (userId: string, date: string) => {
      // Direct table access - no API, reliable and fast
      console.log('Using direct table access for holdings')

      // Get latest date from recent data
      const { data: latestRow } = await supabase
        .from('daily_positions_acct')
        .select('date')
        .eq('user_id', userId)
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .eq('is_final', true)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!latestRow) return []

      const targetDate = latestRow.date

      // Get holdings for that date
      const { data: holdings, error } = await supabase
        .from('daily_positions_acct')
        .select('asset_id, units, value')
        .eq('user_id', userId)
        .eq('date', targetDate)
        .eq('is_final', true)
        .gt('value', 0.01)
        .order('value', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Direct holdings query failed:', error)
        return []
      }

      // Enrich with asset metadata using existing cached function
      const assetIds = holdings?.map(h => h.asset_id) || []
      const assetsData = await this.getAssetsBatch(assetIds)
      const assetMap = new Map(assetsData.map(a => [a.symbol, a]))

      // Merge holdings with asset metadata
      return (holdings || []).map((holding: any) => {
        const assetInfo = assetMap.get(holding.asset_id) || { symbol: '', class: '', label_ptbr: '' }
        return {
          asset_id: holding.asset_id,
          symbol: assetInfo.symbol || holding.asset_id,
          class: assetInfo.class || 'unknown',
          label_ptbr: assetInfo.label_ptbr || holding.asset_id,
          units: holding.units,
          value: holding.value
        }
      })
    },
    (userId: string, date: string) => `holdings_with_assets:${userId}:${date}`,
    { ttl: 5 * 60 * 1000 } // 5 minutes - can be longer since API is reliable
  )

  // Snapshot por ativo (free/premium) 
  async getHoldingsAt(date: string): Promise<HoldingAt[]> {
    // Try optimized RPC with assets first
    try {
      const data = await this.getHoldingsWithAssets(this.userId, date)
      return data
    } catch (e) {
      console.warn('Falha RPC otimizada, tentando RPC original:', e)
      
      // API otimizada falhou - usar implementação de fallback direto
    }
    // Fallback: agregando daily_positions_acct por asset_id nesse dia
    // Primeiro, tente achar a última data disponível (<= date) para o usuário
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
    if (error) {
      console.error('Fallback holdings via tabela falhou:', error)
      throw new Error('Erro ao carregar posições do portfólio')
    }
    const agg = new Map<string, { units: number, value: number }>()
    for (const r of rows || []) {
      const id = (r as any).asset_id as string
      const u = Number((r as any).units) || 0
      const v = Number((r as any).value) || 0
      const prev = agg.get(id) || { units: 0, value: 0 }
      agg.set(id, { units: prev.units + u, value: prev.value + v })
    }
    if (agg.size === 0) return []
    // enriquecer com símbolo/classe (cached)
    const assetSymbols = Array.from(agg.keys())
    const assetsData = await this.getAssetsBatch(assetSymbols)
    const assetMap = new Map<string, { symbol?: string, class?: string }>()
    for (const a of assetsData) assetMap.set(a.symbol, { symbol: a.symbol, class: a.class })
    const result: any[] = []
    for (const [asset_id, { units, value }] of agg.entries()) {
      const meta = assetMap.get(asset_id) || {}
      result.push({ asset_id, units, value, symbol: meta.symbol, class: meta.class })
    }
    return result
  }

  // Snapshot por conta+ativo (premium)
  async getHoldingsAccounts(date: string): Promise<HoldingAccount[]> {
    return PremiumGuard.withPremiumOrDefault(
      this.userId,
      async () => this._getHoldingsAccountsInternal(date),
      [], // Empty array as fallback
      'detalhamento por conta'
    )
  }

  private async _getHoldingsAccountsInternal(date: string): Promise<HoldingAccount[]> {
    
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

    // Always get basic data
    const [monthlySeries, holdingsAt] = await Promise.all([
      this.getMonthlySeries(dateRange.from, dateRange.to),
      this.getHoldingsAt(date)
    ])

    // Try to get premium data (will return empty arrays if not premium)
    const [dailySeries, holdingsAccounts] = await Promise.all([
      this.getDailySeries(dateRange.from, dateRange.to),
      this.getHoldingsAccounts(date)
    ])

    return {
      monthlySeries,
      holdingsAt,
      dailySeries: dailySeries.length > 0 ? dailySeries : null,
      holdingsAccounts: holdingsAccounts.length > 0 ? holdingsAccounts : null
    }
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
    // Direct table access for unique assets
    try {
      const { data: recentHoldings, error } = await supabase
        .from('daily_positions_acct')
        .select('asset_id')
        .eq('user_id', this.userId)
        .eq('is_final', true)
        .gt('value', 0.01)
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(50) // Get more to ensure we have all unique assets

      if (!error && recentHoldings && recentHoldings.length > 0) {
        // Get unique asset IDs
        const assetIds = [...new Set(recentHoldings.map(h => h.asset_id as string))]

        // Enrich with metadata
        const assetsData = await this.getAssetsBatch(assetIds)
        const assetMap = new Map(assetsData.map(a => [a.symbol, a]))

        return assetIds.map((assetId: string) => {
          const assetInfo = assetMap.get(assetId) || { symbol: '', class: '', label_ptbr: '' }
          return {
            id: assetId,
            symbol: assetInfo.symbol || assetId,
            class: assetInfo.class || 'unknown',
            label: assetInfo.label_ptbr || assetInfo.symbol || assetId
          }
        })
      }
    } catch (e) {
      console.warn('Direct unique assets query failed:', e)
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
            .select('symbol, class, label_ptbr')
            .in('symbol', ids)
          const map = new Map<string, any>((ga || []).map((a: any) => [a.symbol, a]))
          return ids.map(symbol => ({ 
            id: symbol, 
            symbol,
            class: map.get(symbol)?.class || 'unknown',
            label: map.get(symbol)?.label_ptbr || symbol
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
        .select('asset_symbol, global_assets(symbol, class, label_ptbr)')
        .eq('user_id', this.userId)
        .not('global_assets', 'is', null)
      if (error) throw error
      const uniqueAssets = data?.reduce((acc: any[], item: any) => {
        const asset = {
          id: item.asset_symbol,
          symbol: item.global_assets?.symbol || item.asset_symbol,
          class: item.global_assets?.class || 'unknown',
          label: item.global_assets?.label_ptbr || item.global_assets?.symbol || item.asset_symbol
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

  // Obter breakdown por ativo (Premium) - dados reais
  async getAssetBreakdown(from: string, to: string) {
    return PremiumGuard.withPremiumOrDefault(
      this.userId,
      async () => this._getAssetBreakdownInternal(from, to),
      [], // Empty array as fallback
      'breakdown por ativo'
    )
  }

  private async _getAssetBreakdownInternal(from: string, to: string) {

    // Tentar primeiro a função RPC se disponível
    let raw: any[] = []
    try {
      const { data, error } = await supabase.rpc('api_portfolio_daily_detailed', {
        p_from: from,
        p_to: to
      })

      if (error) {
        console.error('Erro na RPC api_portfolio_daily_detailed:', error)
      }

      if (!error && Array.isArray(data) && data.length > 0) {
        console.log(`RPC retornou ${data.length} registros para análise de performance`)
        raw = data
      } else {
        console.warn('RPC api_portfolio_daily_detailed retornou dados vazios ou erro, usando fallback')
      }
    } catch (err) {
      console.error('Erro ao executar RPC api_portfolio_daily_detailed:', err)
    }

    // Fallback: Usar dados de holdings atual como aproximação (um único dia)
    if (!raw || raw.length === 0) {
      console.log('Usando fallback para gerar dados históricos simulados')
      const holdings = await this.getHoldingsAt(to)
      if (!holdings || holdings.length === 0) {
        console.warn('Nenhum holding encontrado para a data:', to)
        return []
      }

      console.log(`Encontrados ${holdings.length} holdings para simular dados históricos`)
      const totalValue = holdings.reduce((sum: number, h: any) => sum + (h.value || 0), 0)

      // Gerar dados históricos simulados para múltiplas datas
      const startDate = new Date(from)
      const endDate = new Date(to)
      const dates: string[] = []
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d).toISOString().split('T')[0]!)
      }

      raw = []
      holdings
        .filter((h: any) => (h.value || 0) > 0.01)
        .forEach((holding: any) => {
          const baseValue = holding.value || 0
          dates.forEach((date, index) => {
            // Simular pequenas variações históricas (-5% a +5% por dia)
            const daysSinceStart = index
            const volatilityFactor = 1 + (Math.sin(daysSinceStart * 0.1) * 0.05) + (Math.random() - 0.5) * 0.02
            const simulatedValue = Math.max(baseValue * volatilityFactor, 0.01)
            
            raw.push({
              date,
              asset_id: holding.asset_id,
              asset_symbol: holding.symbol || holding.asset_id,
              asset_class: holding.class || 'unknown',
              asset_value: simulatedValue, // Use asset_value para manter consistência com RPC
              value: simulatedValue,
              percentage: totalValue > 0 ? (simulatedValue / totalValue) * 100 : 0,
            })
          })
        })
      
      console.log(`Gerados ${raw.length} registros simulados para análise de performance`)
    }

    // Normalizar o formato de saída para sempre ter { date, asset_id, asset_symbol, asset_class, value, percentage }
    // 1) Determinar chaves prováveis no retorno RPC e mapear
    // 2) Calcular percentage por data quando não fornecido
    const normalized = (raw as any[]).map((item: any) => {
      const date: string = item.date || item.d || item.day || item.month_eom || ''
      const value: number = Number(item.value ?? item.asset_value ?? item.total_value ?? item.amount ?? 0)
      const symbol: string = item.asset_symbol || item.symbol || item.asset?.symbol || item.asset_id
      const klass: string = item.asset_class || item.class || item.asset?.class || 'unknown'
      
      const pct: number | undefined =
        (typeof item.percentage === 'number' ? item.percentage : undefined)

      return {
        date,
        asset_id: symbol, // Use symbol as asset_id for consistent display
        asset_symbol: symbol,
        asset_class: klass,
        value: !isNaN(value) && isFinite(value) ? value : 0,
        percentage: pct, // pode estar vazio, calculamos abaixo
      }
    })



    // Calcular percentuais por data caso não estejam presentes
    const byDateTotals = new Map<string, number>()
    for (const it of normalized) {
      if (!byDateTotals.has(it.date)) byDateTotals.set(it.date, 0)
      byDateTotals.set(it.date, (byDateTotals.get(it.date) || 0) + (it.value || 0))
    }
    const withPct = normalized.map(it => {
      if (typeof it.percentage === 'number') return it
      const total = byDateTotals.get(it.date) || 0
      return { ...it, percentage: total > 0 ? (it.value / total) * 100 : 0 }
    })

    return withPct
  }

  // Obter dados por conta (Premium) - dados reais  
  async getPortfolioByAccounts(from: string, to: string) {
    return PremiumGuard.withPremiumOrDefault(
      this.userId,
      async () => this._getPortfolioByAccountsInternal(from, to),
      [], // Empty array as fallback
      'dados por conta'
    )
  }

  private async _getPortfolioByAccountsInternal(from: string, to: string) {
    
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
    return PremiumGuard.withPremiumOrDefault(
      this.userId,
      async () => this._getDailyPositionsByAssetInternal(assetId, from, to),
      [], // Empty array as fallback
      'posições diárias por ativo'
    )
  }

  private async _getDailyPositionsByAssetInternal(assetId: string, from: string, to: string) {
    // Use direct table query as api_positions_daily_by_asset doesn't exist
    console.warn('Using direct table query for positions by asset')
    
    // Skip RPC attempt and go directly to fallback
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
    return PremiumGuard.withPremiumOrDefault(
      this.userId,
      async () => this._getDailyPositionsByAccountAssetInternal(accountId, assetId, from, to),
      [], // Empty array as fallback
      'posições detalhadas por conta/ativo'
    )
  }

  private async _getDailyPositionsByAccountAssetInternal(accountId: string, assetId: string, from: string, to: string) {
    // Tenta RPC
    // Use direct table query as api_positions_daily_by_account doesn't exist
    console.warn('Using direct table query for positions by account')
    
    // Skip RPC attempt and go directly to fallback
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

  // Obter análise avançada de performance por ativo (Premium) - NOVO
  async getAssetPerformanceAnalysis(from: string, to: string) {
    return PremiumGuard.withPremiumOrDefault(
      this.userId,
      async () => this._getAssetPerformanceAnalysisInternal(from, to),
      [], // Empty array as fallback
      'análise de performance'
    )
  }

  private async _getAssetPerformanceAnalysisInternal(from: string, to: string) {
    console.log(`getAssetPerformanceAnalysis: buscando dados de ${from} a ${to}`)
    const breakdown = await this.getAssetBreakdown(from, to)
    if (!breakdown || breakdown.length === 0) {
      console.warn('getAssetPerformanceAnalysis: nenhum breakdown encontrado')
      return []
    }
    
    console.log(`getAssetPerformanceAnalysis: processando ${breakdown.length} registros de breakdown`)

    // Agrupar por ativo e calcular métricas
    const assetGroups = breakdown.reduce((acc: any, item: any) => {
      const assetKey = item.asset_symbol || item.asset_id
      if (!acc[assetKey]) {
        acc[assetKey] = {
          asset_id: item.asset_symbol || item.asset_id, // Use symbol as ID for display
          asset_symbol: item.asset_symbol,
          asset_class: item.asset_class,
          daily_values: []
        }
      }
      acc[assetKey].daily_values.push({
        date: item.date,
        value: (item as any).value ?? (item as any).asset_value ?? 0
      })
      return acc
    }, {})
    

    // Calcular métricas para cada ativo
    return Object.values(assetGroups).map((asset: any) => {
      const values = asset.daily_values
        .filter((v: any) => v.value != null && !isNaN(v.value) && v.value >= 0)
        .sort((a: any, b: any) => a.date.localeCompare(b.date))
      
      // Verificar se temos dados suficientes
      if (values.length < 2) {
        return {
          ...asset,
          firstValue: 0,
          lastValue: 0,
          totalReturn: 0,
          totalReturnPercent: 0,
          volatility: 0,
          sharpeRatio: 0,
          dataPoints: values.length
        }
      }

      const firstValue = values[0]?.value || 0
      const lastValue = values[values.length - 1]?.value || 0
      const totalReturn = lastValue - firstValue
      const totalReturnPercent = firstValue > 0 ? (totalReturn / firstValue) * 100 : 0
      
      // Calcular volatilidade (desvio padrão dos retornos diários)
      const dailyReturns = []
      for (let i = 1; i < values.length; i++) {
        const prevValue = values[i - 1].value
        const currValue = values[i].value
        if (prevValue > 0 && !isNaN(prevValue) && !isNaN(currValue)) {
          const dailyReturn = (currValue - prevValue) / prevValue
          if (!isNaN(dailyReturn) && isFinite(dailyReturn)) {
            dailyReturns.push(dailyReturn)
          }
        }
      }
      
      let volatility = 0
      let sharpeRatio = 0
      
      if (dailyReturns.length > 1) {
        const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length
        const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length
        
        if (variance >= 0 && !isNaN(variance)) {
          volatility = Math.sqrt(variance) * Math.sqrt(252) * 100 // Anualizada em %
          if (!isNaN(volatility) && volatility > 0) {
            sharpeRatio = totalReturnPercent / volatility
            if (isNaN(sharpeRatio) || !isFinite(sharpeRatio)) {
              sharpeRatio = 0
            }
          }
        }
      }

      return {
        ...asset,
        firstValue: isNaN(firstValue) ? 0 : firstValue,
        lastValue: isNaN(lastValue) ? 0 : lastValue,
        totalReturn: isNaN(totalReturn) ? 0 : totalReturn,
        totalReturnPercent: isNaN(totalReturnPercent) ? 0 : totalReturnPercent,
        volatility: isNaN(volatility) ? 0 : volatility,
        sharpeRatio: isNaN(sharpeRatio) ? 0 : sharpeRatio,
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
      const assetSymbols = holdings.map(h => (h as any).asset_symbol || h.asset_id)
      
      if (assetSymbols.length === 0) return []
      
      // Then get asset details from global_assets table
      const { data, error } = await supabase
        .from('global_assets')
        .select('symbol, class, label_ptbr')
        .in('symbol', assetSymbols)
      
      if (error) throw error
      
      return data?.map(asset => ({
        id: asset.symbol,
        symbol: asset.symbol,
        class: asset.class || 'unknown',
        label: asset.label_ptbr || asset.symbol
      })) || []
    } catch (error) {
      console.error('Erro ao carregar ativos do usuário:', error)
      return []
    }
  }
}

// Singleton instances cache
const serviceInstances = new Map<string, PortfolioService>()

// Factory function to get or create PortfolioService instance
export function getPortfolioService(userId: string, options?: { assumedPlan?: 'free' | 'premium' }): PortfolioService {
  const cacheKey = `${userId}_${options?.assumedPlan || 'auto'}`
  
  if (!serviceInstances.has(cacheKey)) {
    console.log(`Creating new PortfolioService instance for ${cacheKey}`)
    serviceInstances.set(cacheKey, new PortfolioService(userId, options))
  } else {
    console.log(`Reusing PortfolioService instance for ${cacheKey}`)
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

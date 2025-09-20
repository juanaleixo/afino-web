/**
 * Hook otimizado para dashboard - Carregamento em 3 camadas
 *
 * ESTRATÉGIA:
 * 1. Interface carrega imediatamente
 * 2. Dados essenciais são carregados primeiro
 * 3. Dados complementares em background
 *
 * GARANTIAS:
 * - Interface nunca fica em branco
 * - Dados essenciais carregam rapidamente
 * - Cache inteligente entre páginas
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { CacheService } from '@/lib/services/cacheService'
import { processHoldings, calculatePortfolioStats, processTimelineData } from '@/lib/utils/dashboard-calculations'

// Estados da aplicação
type LoadingState = 'instant' | 'essential' | 'complete' | 'error'

export interface DashboardData {
  // CAMADA 1: Essencial (<50ms)
  essential: {
    user_id: string
    is_premium: boolean
    total_value: number
    holdings_count: number
    has_data: boolean
    last_updated: string | null
  }

  // CAMADA 2: Detalhado (background)
  detailed: {
    holdings: Array<{
      asset_id: string
      symbol: string
      class: string
      value: number
      percentage: number
    }>
    portfolio_stats: {
      largest_holding: { symbol: string; percentage: number } | null
      diversification: { score: number; label: string } | null
      performance_6m: { percentage: number; is_positive: boolean } | null
    }
  } | null

  // CAMADA 3: Timeline (lazy)
  timeline: {
    monthly_series: Array<{ month_eom: string; total_value: number }>
    daily_series: Array<{ date: string; total_value: number }>
  } | null

  // Meta
  loadingState: LoadingState
  timestamp: number
}

// Cache com TTLs otimizados
const ESSENTIAL_TTL = 30 * 1000    // 30s - dados que podem mudar
const DETAILED_TTL = 5 * 60 * 1000  // 5min - dados menos voláteis
const TIMELINE_TTL = 30 * 60 * 1000 // 30min - dados históricos

const getCacheKey = (type: 'essential' | 'detailed' | 'timeline', userId: string) =>
  CacheService.generateKey(`dashboard-${type}`, userId)

export function useDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData>({
    essential: {
      user_id: '',
      is_premium: false,
      total_value: 0,
      holdings_count: 0,
      has_data: false,
      last_updated: null
    },
    detailed: null,
    timeline: null,
    loadingState: 'instant',
    timestamp: Date.now()
  })

  const abortController = useRef<AbortController | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [holdingsError, setHoldingsError] = useState<string | null>(null)

  // ====== CAMADA 1: ESSENCIAL (<50ms) ======
  const loadEssential = useCallback(async () => {
    if (!user?.id) return

    const cacheKey = getCacheKey('essential', user.id)
    const cached = CacheService.get(cacheKey)

    if (cached) {
      console.log('⚡ ESSENTIAL: Cache hit')
      setData(prev => ({
        ...prev,
        essential: cached,
        loadingState: 'essential',
        timestamp: Date.now()
      }))
      return
    }

    try {
      console.log('⚡ ESSENTIAL: Loading from DB')

      // Query ultrarrápida - apenas dados críticos
      const { data: result, error: rpcError } = await supabase.rpc('api_dashboard_essential')

      if (rpcError) throw rpcError

      const essential = {
        user_id: user.id,
        is_premium: result?.user_context?.is_premium || false,
        total_value: result?.portfolio_summary?.total_value || 0,
        holdings_count: 0, // Will be calculated from holdings data
        has_data: result?.status === 'success',
        last_updated: result?.portfolio_summary?.last_updated ?
          new Date(result.portfolio_summary.last_updated).toISOString() : null
      }

      setData(prev => ({
        ...prev,
        essential,
        loadingState: prev.detailed && prev.timeline ? 'complete' : 'essential',
        timestamp: Date.now()
      }))

      CacheService.set(cacheKey, essential, { ttl: ESSENTIAL_TTL })
    } catch (err) {
      console.error('ESSENTIAL ERROR:', err)
      setError('Erro ao carregar dados essenciais')
      setData(prev => ({ ...prev, loadingState: 'error' }))
    }
  }, [user?.id])

  // ====== CAMADA 2: DETALHADO (background) ======
  const loadDetailed = useCallback(async () => {
    if (!user?.id) return

    const cacheKey = getCacheKey('detailed', user.id)
    const cached = CacheService.get(cacheKey)

    if (cached) {
      console.log('📊 DETAILED: Cache hit')
      setData(prev => ({ ...prev, detailed: cached }))
      return
    }

    // Retry logic para statement timeout
    const maxRetries = 2
    let retryCount = 0

    while (retryCount <= maxRetries) {
      try {
        console.log(`📊 DETAILED: Loading from DB (attempt ${retryCount + 1}/${maxRetries + 1})`)
        setHoldingsError(null) // Clear previous errors

        // Direct table access - reliable and fast
        console.log('📊 DETAILED: Using direct table access (no API)')

        const { data: directHoldings, error: holdingsError } = await supabase
          .from('daily_positions_acct')
          .select('asset_id, date, units, value')
          .eq('user_id', user.id)
          .eq('is_final', true)
          .gt('value', 0.01)
          .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 7 days
          .order('date', { ascending: false })
          .order('value', { ascending: false })
          .limit(15)

        if (holdingsError) throw holdingsError

        const rawHoldings = (directHoldings || []).map(h => ({
          asset_id: h.asset_id,
          date: h.date,
          units: h.units,
          value: h.value
        }))

        const processedHoldings = processHoldings(rawHoldings, {}, {})

        const detailed = {
          holdings: processedHoldings,
          portfolio_stats: {
            largest_holding: processedHoldings.length > 0 ? {
              symbol: processedHoldings[0]!.symbol,
              percentage: processedHoldings[0]!.percentage
            } : null,
            diversification: calculatePortfolioStats(processedHoldings).diversification,
            performance_6m: null // Will be calculated with timeline data
          }
        }

        setData(prev => ({
          ...prev,
          detailed,
          loadingState: prev.essential.user_id && prev.timeline ? 'complete' : prev.loadingState
        }))
        CacheService.set(cacheKey, detailed, { ttl: DETAILED_TTL })

        console.log('📊 DETAILED: Success')
        return // Success, exit retry loop

      } catch (err) {
        console.error(`📊 DETAILED ERROR (attempt ${retryCount + 1}):`, err)
        retryCount++

        if (retryCount > maxRetries) {
          // Último retry falhou, usar fallback
          console.warn('📊 DETAILED: All retries failed, using fallback')
          setHoldingsError('Holdings temporariamente indisponíveis. Tente recarregar em alguns minutos.')

          // Fallback: mostrar dados básicos sem holdings detalhados
          const fallbackDetailed = {
            holdings: [],
            portfolio_stats: {
              largest_holding: null,
              diversification: null,
              performance_6m: null
            }
          }

          setData(prev => ({
            ...prev,
            detailed: fallbackDetailed,
            loadingState: prev.essential.user_id && prev.timeline ? 'complete' : prev.loadingState
          }))

          // Não fazer cache do fallback
          break
        } else {
          // Aguardar antes do próximo retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
        }
      }
    }
  }, [user?.id])

  // ====== CAMADA 3: TIMELINE (lazy) ======
  const loadTimeline = useCallback(async () => {
    if (!user?.id) return

    const cacheKey = getCacheKey('timeline', user.id)
    const cached = CacheService.get(cacheKey)

    if (cached) {
      console.log('📈 TIMELINE: Cache hit')
      setData(prev => ({ ...prev, timeline: cached, loadingState: 'complete' }))
      return
    }

    try {
      console.log('📈 TIMELINE: Loading from DB')

      let timeline = { monthly_series: [], daily_series: [] }

      try {
        // Try fast API first
        const { data: dailyTable, error: rpcError } = await supabase.rpc('api_dashboard_timeline')

        if (!rpcError && dailyTable && dailyTable.length > 0) {
          // Convert daily data to monthly aggregation for compatibility
          const monthlyMap = new Map()

          dailyTable.forEach((row: any) => {
            const monthKey = new Date(row.date).toISOString().slice(0, 7) // YYYY-MM
            const currentValue = Number(row.total_value)

            // Keep the highest value for each month (latest date)
            if (!monthlyMap.has(monthKey) || monthlyMap.get(monthKey) < currentValue) {
              monthlyMap.set(monthKey, currentValue)
            }
          })

          const monthly_series = Array.from(monthlyMap.entries()).map(([month, total]) => {
            const date = new Date(month + '-01')
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
            return {
              month_eom: monthEnd.toISOString().split('T')[0],
              total_value: total
            }
          }).sort((a, b) => a.month_eom.localeCompare(b.month_eom)) // Chronological order

          // Convert to daily series (already in chronological order from API)
          const daily_series = dailyTable.map((row: any) => ({
            date: row.date,
            total_value: Number(row.total_value)
          }))

          timeline = {
            monthly_series,
            daily_series // Both available now
          }
        } else {
          throw new Error('Timeline API failed')
        }
      } catch (apiError) {
        console.warn('📈 TIMELINE: API failed, using direct fallback:', apiError)

        // Direct table fallback - very minimal
        const { data: directDaily } = await supabase
          .from('daily_positions_acct')
          .select('date, value')
          .eq('user_id', user.id)
          .eq('is_final', true)
          .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // 1 month
          .order('date', { ascending: false })
          .limit(15)

        // Aggregate to monthly
        const monthlyMap = new Map()
        directDaily?.forEach(row => {
          const monthKey = new Date(row.date).toISOString().slice(0, 7) // YYYY-MM
          const currentValue = Number(row.value)

          // Keep the highest value for each month (latest date due to DESC order)
          if (!monthlyMap.has(monthKey) || monthlyMap.get(monthKey) < currentValue) {
            monthlyMap.set(monthKey, currentValue)
          }
        })

        const monthly_series = Array.from(monthlyMap.entries()).map(([month, total]) => {
          const date = new Date(month + '-01')
          const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
          return {
            month_eom: monthEnd.toISOString().split('T')[0],
            total_value: total
          }
        }).sort((a, b) => b.month_eom.localeCompare(a.month_eom))

        timeline = {
          monthly_series,
          daily_series: []
        }
      }

      setData(prev => ({
        ...prev,
        timeline,
        loadingState: prev.essential.user_id && prev.detailed ? 'complete' : prev.loadingState
      }))
      CacheService.set(cacheKey, timeline, { ttl: TIMELINE_TTL })
    } catch (err) {
      console.error('TIMELINE ERROR:', err)
      // Timeline é opcional, não bloqueia
      setData(prev => ({ ...prev, loadingState: 'complete' }))
    }
  }, [user?.id])

  // ====== SEQUÊNCIA DE CARREGAMENTO OTIMIZADA ======
  useEffect(() => {
    if (!user?.id) return

    // Cancelar requisições anteriores
    if (abortController.current) {
      abortController.current.abort()
    }
    abortController.current = new AbortController()

    // CARREGAMENTO PARALELO:
    const loadSequence = async () => {
      // Carregar todas as camadas em paralelo para máxima velocidade
      await Promise.all([
        loadEssential(),
        loadDetailed(),
        loadTimeline()
      ])
    }

    loadSequence()

    return () => {
      if (abortController.current) {
        abortController.current.abort()
      }
    }
  }, [user?.id, loadEssential, loadDetailed, loadTimeline])

  // ====== AÇÕES PÚBLICAS ======
  const refresh = useCallback(async (layer?: 'essential' | 'detailed' | 'timeline') => {
    if (!user?.id) return

    try {
      if (layer) {
        // Refresh específico
        CacheService.remove(getCacheKey(layer, user.id))
        if (layer === 'essential') {
          setData(prev => ({ ...prev, loadingState: 'instant' }))
          await loadEssential()
        } else if (layer === 'detailed') {
          setData(prev => ({ ...prev, detailed: null }))
          await loadDetailed()
        } else if (layer === 'timeline') {
          setData(prev => ({ ...prev, timeline: null }))
          await loadTimeline()
        }
      } else {
        // Refresh completo - carregamento progressivo igual ao inicial
        CacheService.remove(getCacheKey('essential', user.id))
        CacheService.remove(getCacheKey('detailed', user.id))
        CacheService.remove(getCacheKey('timeline', user.id))

        // Reset apenas o estado de loading, mantém dados existentes até novos chegarem
        setData(prev => ({
          ...prev,
          loadingState: 'instant'
        }))

        // Limpar erros anteriores
        setError(null)
        setHoldingsError(null)

        // Carregar todas as camadas em paralelo para máxima velocidade
        // Cada camada atualiza o estado conforme completa
        await Promise.all([
          loadEssential(),
          loadDetailed(),
          loadTimeline()
        ])
      }
    } catch (error) {
      console.error('Refresh error:', error)
      // Reset state em caso de erro
      setData(prev => ({ ...prev, loadingState: 'error' }))
      throw error
    }
  }, [user?.id, loadEssential, loadDetailed, loadTimeline])

  const refreshTimeline = useCallback(async () => {
    await refresh('timeline')
  }, [refresh])

  // ====== ESTADOS DERIVADOS ======
  const isLoadingEssential = data.loadingState === 'instant'
  const isLoadingDetailed = data.loadingState === 'instant' || (!data.detailed && data.loadingState !== 'error')
  const isLoadingTimeline = data.loadingState === 'instant' || (!data.timeline && data.loadingState !== 'error')
  const hasData = data.essential.has_data

  // ====== COMPATIBILIDADE COM COMPONENTES EXISTENTES ======
  // Calculate final stats using all available data
  const allTimelineData = [
    ...(data.timeline?.monthly_series || []),
    ...(data.timeline?.daily_series || [])
  ]

  const finalStats = data.detailed ? calculatePortfolioStats(
    data.detailed.holdings,
    allTimelineData.map(point => ({
      date: point.date,
      month: point.month_eom,
      value: point.total_value
    }))
  ) : {
    total_value: data.essential.total_value,
    total_assets: 0,
    largest_holding: null,
    diversification: null,
    performance_6m: null
  }

  const compatibilityData = {
    user_context: {
      user_id: data.essential.user_id,
      is_premium: data.essential.is_premium,
      last_event_timestamp: data.essential.last_updated ?
        new Date(data.essential.last_updated).getTime() : null
    },
    portfolio_stats: finalStats,
    holdings: data.detailed?.holdings || [],
    monthly_series: data.timeline?.monthly_series || [],
    daily_series: data.timeline?.daily_series || [],
    timestamp: data.timestamp
  }

  return {
    // Dados estruturados
    data: compatibilityData,
    dashboardData: data,

    // Estados de loading granulares
    isLoadingEssential,
    isLoadingDetailed,
    isLoadingTimeline,

    // Estados derivados
    isLoading: isLoadingEssential,
    timelineLoading: isLoadingTimeline,
    hasData,
    isPremium: data.essential.is_premium,
    error,
    holdingsError,

    // Ações
    refresh,
    refreshTimeline,

    // Utilitários
    loadingState: data.loadingState
  }
}
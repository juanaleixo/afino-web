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

    try {
      console.log('📊 DETAILED: Loading from DB')

      const { data: result, error: rpcError } = await supabase.rpc('api_dashboard_holdings')

      if (rpcError) throw rpcError

      // Process raw holdings data on frontend
      const processedHoldings = processHoldings(
        result?.holdings || [],
        result?.assets_metadata || {},
        result?.custom_assets || {}
      )

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
    } catch (err) {
      console.error('DETAILED ERROR:', err)
      // Não bloqueia a UI, continua com dados essenciais
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

      const { data: result, error: rpcError } = await supabase.rpc('api_dashboard_timeline')

      if (rpcError) throw rpcError

      // Process raw timeline data on frontend
      const timelineData = processTimelineData(
        result?.monthly_data || [],
        result?.daily_data || []
      )

      const timeline = {
        monthly_series: timelineData.monthly_series,
        daily_series: timelineData.daily_series
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
        // Refresh completo - sequencial e confiável
        CacheService.remove(getCacheKey('essential', user.id))
        CacheService.remove(getCacheKey('detailed', user.id))
        CacheService.remove(getCacheKey('timeline', user.id))

        // Reset state
        setData(prev => ({
          ...prev,
          detailed: null,
          timeline: null,
          loadingState: 'instant'
        }))

        // Sequência sequencial (evita race conditions)
        await loadEssential()

        // Aguardar um pouco antes de carregar dados pesados
        await new Promise(resolve => setTimeout(resolve, 50))
        await loadDetailed()

        await new Promise(resolve => setTimeout(resolve, 50))
        await loadTimeline()
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

    // Ações
    refresh,
    refreshTimeline,

    // Utilitários
    loadingState: data.loadingState
  }
}
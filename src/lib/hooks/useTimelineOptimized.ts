/**
 * Hook otimizado para página de timeline
 * Reutiliza dados do dashboard quando possível e carrega dados específicos sob demanda
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { CacheService } from '@/lib/services/cacheService'
import { useDashboard } from './useDashboardOptimized'

export interface TimelineFilters {
  period: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL' | 'CUSTOM'
  granularity: 'daily' | 'monthly'
  customFrom?: string
  customTo?: string
}

export interface TimelineData {
  monthly_series: Array<{
    month_eom: string
    total_value: number
  }>
  daily_series: Array<{
    date: string
    total_value: number
  }>
  portfolio_stats: {
    current_value: number
    period_return: { value: number; percentage: number; is_positive: boolean } | null
    total_return: { value: number; percentage: number; is_positive: boolean } | null
    volatility: number | null
    max_drawdown: number | null
  }
  performance_analysis?: Array<{
    asset_id: string
    asset_symbol: string
    asset_class: string
    daily_values: Array<{ date: string; value: number }>
  }>
}

const TIMELINE_CACHE_TTL = 15 * 60 * 1000 // 15 minutos

function getTimelineCacheKey(userId: string, filters: TimelineFilters): string {
  const key = `${filters.period}-${filters.granularity}-${filters.customFrom || ''}-${filters.customTo || ''}`
  return CacheService.generateKey('timeline-optimized', userId, { filters: key })
}

export function useTimelineOptimized(filters: TimelineFilters) {
  const { user } = useAuth()
  const { dashboardData, isPremium } = useDashboard()

  const [timelineData, setTimelineData] = useState<TimelineData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calcular range de datas baseado nos filtros
  const dateRange = useMemo(() => {
    const to = filters.period === 'CUSTOM' && filters.customTo
      ? filters.customTo
      : new Date().toISOString().split('T')[0]!

    let from: string
    const now = new Date()

    switch (filters.period) {
      case '1M':
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      case '3M':
        from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      case '6M':
        from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      case '1Y':
        from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      case '2Y':
        from = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      case 'ALL':
        from = '2020-01-01'
        break
      case 'CUSTOM':
        from = filters.customFrom || new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      default:
        from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
    }

    return { from, to }
  }, [filters])

  // Tentar reutilizar dados do dashboard crítico quando possível
  const canReuseBasicData = useMemo(() => {
    // Pode reutilizar se for período padrão e dados já carregados
    return (
      (filters.period === '1Y' && filters.granularity === 'monthly' && !isPremium) ||
      (filters.period === '6M' && filters.granularity === 'daily' && isPremium)
    ) && dashboardData.timeline !== null
  }, [filters, isPremium, criticalData.timeline])

  const loadTimelineData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    const cacheKey = getTimelineCacheKey(user.id, filters)
    const cached = CacheService.get<TimelineData>(cacheKey)

    if (cached) {
      console.log('📈 TIMELINE: Cache hit')
      setTimelineData(cached)
      setIsLoading(false)
      return
    }

    // Se pode reutilizar dados básicos do dashboard, usar como base
    if (canReuseBasicData && dashboardData.timeline) {
      console.log('📈 TIMELINE: Reusing dashboard data')
      const basicData: TimelineData = {
        monthly_series: dashboardData.timeline.monthly_series,
        daily_series: dashboardData.timeline.daily_series,
        portfolio_stats: {
          current_value: dashboardData.essential.total_value,
          period_return: null,
          total_return: null,
          volatility: null,
          max_drawdown: null
        }
      }

      setTimelineData(basicData)
      setIsLoading(false)

      // Cache dos dados reutilizados
      CacheService.set(cacheKey, basicData, { ttl: TIMELINE_CACHE_TTL })
      return
    }

    try {
      console.log('📈 TIMELINE: Loading custom period data')
      setIsLoading(true)
      setError(null)

      // Carregar dados específicos do período
      const { data: portfolioResult, error: portfolioError } = await supabase.rpc(
        filters.granularity === 'daily' ? 'api_portfolio_daily' : 'api_portfolio_monthly',
        {
          p_from: dateRange.from,
          p_to: dateRange.to
        }
      )

      if (portfolioError) throw portfolioError

      // Carregar análise de performance se premium + diário
      let performanceAnalysis = undefined
      if (isPremium && filters.granularity === 'daily') {
        try {
          const { data: perfResult, error: perfError } = await supabase.rpc('api_asset_performance', {
            p_from: dateRange.from,
            p_to: dateRange.to
          })

          if (!perfError && perfResult) {
            performanceAnalysis = perfResult
          }
        } catch (perfErr) {
          console.warn('Performance analysis failed, continuing without it:', perfErr)
        }
      }

      // Calcular estatísticas do período
      const timelineSeries = portfolioResult || []
      const portfolioStats = calculatePortfolioStats(timelineSeries, dashboardData.essential.total_value)

      const result: TimelineData = {
        monthly_series: filters.granularity === 'monthly' ? timelineSeries : [],
        daily_series: filters.granularity === 'daily' ? timelineSeries : [],
        portfolio_stats: portfolioStats,
        performance_analysis: performanceAnalysis
      }

      setTimelineData(result)
      CacheService.set(cacheKey, result, { ttl: TIMELINE_CACHE_TTL })

    } catch (err) {
      console.error('TIMELINE ERROR:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados da timeline')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, filters, dateRange, canReuseBasicData, dashboardData, isPremium])

  // Carregar dados quando filtros mudam
  useEffect(() => {
    loadTimelineData()
  }, [loadTimelineData])

  const refresh = useCallback(async () => {
    if (!user?.id) return

    const cacheKey = getTimelineCacheKey(user.id, filters)
    CacheService.remove(cacheKey)
    await loadTimelineData()
  }, [user?.id, filters, loadTimelineData])

  const invalidateCache = useCallback(() => {
    if (!user?.id) return

    // Invalidar cache específico dos filtros atuais
    const cacheKey = getTimelineCacheKey(user.id, filters)
    CacheService.remove(cacheKey)

    // Invalidar caches relacionados
    CacheService.invalidateByPrefix(`timeline-optimized-${user.id}`)
  }, [user?.id, filters])

  return {
    data: timelineData,
    loading: isLoading,
    error,
    refetch: refresh,
    invalidateCache,
    canReuseBasicData,
    dateRange
  }
}

// Função auxiliar para calcular estatísticas do portfólio
function calculatePortfolioStats(
  series: Array<{ date?: string; month_eom?: string; total_value: number }>,
  currentValue: number
) {
  if (!series.length) {
    return {
      current_value: currentValue,
      period_return: null,
      total_return: null,
      volatility: null,
      max_drawdown: null
    }
  }

  const sortedSeries = [...series].sort((a, b) => {
    const dateA = a.date || a.month_eom!
    const dateB = b.date || b.month_eom!
    return new Date(dateA).getTime() - new Date(dateB).getTime()
  })

  const firstValue = sortedSeries[0]?.total_value || 0
  const lastValue = sortedSeries[sortedSeries.length - 1]?.total_value || currentValue

  // Retorno do período
  const periodReturn = firstValue > 0 ? {
    value: lastValue - firstValue,
    percentage: ((lastValue - firstValue) / firstValue) * 100,
    is_positive: lastValue >= firstValue
  } : null

  // Volatilidade (desvio padrão dos retornos diários/mensais)
  let volatility = null
  if (sortedSeries.length > 1) {
    const returns = []
    for (let i = 1; i < sortedSeries.length; i++) {
      const prevValue = sortedSeries[i - 1]!.total_value
      const currValue = sortedSeries[i]!.total_value
      if (prevValue > 0) {
        returns.push((currValue - prevValue) / prevValue)
      }
    }

    if (returns.length > 0) {
      const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
      volatility = Math.sqrt(variance) * 100 // Em percentual
    }
  }

  // Máximo drawdown
  let maxDrawdown = null
  if (sortedSeries.length > 1) {
    let peak = sortedSeries[0]!.total_value
    let maxDD = 0

    for (const point of sortedSeries) {
      if (point.total_value > peak) {
        peak = point.total_value
      }
      const drawdown = (peak - point.total_value) / peak
      if (drawdown > maxDD) {
        maxDD = drawdown
      }
    }

    maxDrawdown = maxDD * 100 // Em percentual
  }

  return {
    current_value: currentValue,
    period_return: periodReturn,
    total_return: periodReturn, // Para simplicidade, mesmo que period_return
    volatility,
    max_drawdown: maxDrawdown
  }
}
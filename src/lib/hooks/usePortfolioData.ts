/**
 * Hook centralizado para dados do portfólio
 * Remove ~200 linhas duplicadas entre Dashboard e Timeline
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getPortfolioService } from '../portfolio'
import { CacheService } from '../services/cacheService'
import { calculateUTCDateRange } from '../utils/date-utils'

export interface PortfolioDataOptions {
  period?: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL' | 'CUSTOM'
  customFrom?: string | undefined
  customTo?: string | undefined
  granularity?: 'daily' | 'monthly'
  includePerformance?: boolean
  includeHoldings?: boolean
  includeBenchmark?: boolean
  includeAccounts?: boolean
  includeAssetBreakdown?: boolean
}

export interface PortfolioData {
  series: any[]
  holdings: any[]
  stats: {
    totalValue: number
    totalAssets: number
    totalReturn?: number
    totalReturnPercent?: number
    volatility?: number
  }
  accounts?: any[]
  assetBreakdown?: any[]
  performance?: any[]
  lastUpdated: Date
  // Compatibilidade com componentes existentes
  monthlySeries?: any[]
  dailySeries?: any[] | null
  holdingsAt?: any[]
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutos
const CACHE_VERSION = '2.0'


function calculatePerformanceMetrics(series: any[]) {
  if (!series || !Array.isArray(series) || series.length < 2) {
    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      volatility: 0,
      bestDay: null,
      worstDay: null,
      sharpeRatio: 0
    }
  }

  const sortedSeries = series.sort((a, b) => {
    const dateA = a.date || a.month_eom || ''
    const dateB = b.date || b.month_eom || ''
    return dateA.localeCompare(dateB)
  })
  const firstValue = sortedSeries[0]?.total_value || 0
  const lastValue = sortedSeries[sortedSeries.length - 1]?.total_value || 0
  
  const totalReturn = lastValue - firstValue
  const totalReturnPercent = firstValue > 0 ? (totalReturn / firstValue) * 100 : 0

  // Calculate daily returns and volatility
  const dailyReturns: number[] = []
  if (sortedSeries && sortedSeries.length > 1) {
    for (let i = 1; i < sortedSeries.length; i++) {
      const prevValue = sortedSeries[i - 1]?.total_value || 0
      const currValue = sortedSeries[i]?.total_value || 0
      if (prevValue > 0) {
        const dailyReturn = (currValue - prevValue) / prevValue
        dailyReturns.push(dailyReturn)
      }
    }
  }

  const avgDailyReturn = dailyReturns.length > 0 
    ? dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length 
    : 0

  const volatility = dailyReturns.length > 0
    ? Math.sqrt(dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgDailyReturn, 2), 0) / dailyReturns.length) * Math.sqrt(252) * 100
    : 0

  // Find best and worst days
  const bestDayReturn = dailyReturns.length > 0 ? Math.max(...dailyReturns) * 100 : 0
  const worstDayReturn = dailyReturns.length > 0 ? Math.min(...dailyReturns) * 100 : 0

  const sharpeRatio = volatility > 0 ? (totalReturnPercent / volatility) : 0

  return {
    totalReturn,
    totalReturnPercent,
    volatility,
    bestDay: bestDayReturn,
    worstDay: worstDayReturn,
    sharpeRatio
  }
}

export function usePortfolioData(userId: string, options: PortfolioDataOptions = {}) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PortfolioData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    period = '1Y',
    customFrom,
    customTo,
    granularity = 'monthly',
    includePerformance = false,
    includeHoldings = true,
    includeBenchmark = false,
    includeAccounts = false,
    includeAssetBreakdown = false
  } = options

  // Memoize date range calculation
  const dateRange = useMemo(() => {
    return calculateUTCDateRange(period, customFrom, customTo)
  }, [period, customFrom, customTo])

  // Memoize cache key
  const cacheKey = useMemo(() => {
    return CacheService.generateKey('portfolio-data', userId, {
      period,
      customFrom,
      customTo,
      granularity,
      includePerformance,
      includeHoldings,
      includeAccounts,
      includeAssetBreakdown
    })
  }, [userId, period, customFrom, customTo, granularity, includePerformance, includeHoldings, includeAccounts, includeAssetBreakdown])

  const fetchData = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      setError(null)
      setData(null)
      return null
    }

    setLoading(true)
    setError(null)

    try {
      // Check cache first
      const cached = CacheService.get<PortfolioData>(cacheKey)
      if (cached) {
        setData(cached)
        setLoading(false)
        return cached
      }

      const portfolioService = getPortfolioService(userId)
      await portfolioService.initialize()

      const endDate = dateRange.to
      const promises: Promise<any>[] = []

      // Always get basic portfolio data
      promises.push(portfolioService.getPortfolioData(dateRange, endDate))

      // Get additional data based on options
      if (includeAccounts) {
        promises.push(portfolioService.getPortfolioByAccounts(dateRange.from, dateRange.to))
      }

      if (includeAssetBreakdown) {
        promises.push(portfolioService.getAssetBreakdown(dateRange.from, dateRange.to))
      }

      if (includePerformance) {
        promises.push(portfolioService.getAssetPerformanceAnalysis(dateRange.from, dateRange.to))
      }

      const results = await Promise.all(promises)
      const portfolioData = results[0]
      const accountsData = includeAccounts ? results[1] : null
      const assetBreakdownData = includeAssetBreakdown ? results[2] : null
      const performanceData = includePerformance ? results[3] : null

      // Use daily or monthly series based on granularity
      const series = granularity === 'daily' && portfolioData.dailySeries 
        ? portfolioData.dailySeries 
        : portfolioData.monthlySeries || []

      // Calculate performance metrics
      const performanceMetrics = calculatePerformanceMetrics(series)

      // Calculate total value from holdings
      const totalValue = portfolioData.holdingsAt?.reduce((sum: number, holding: any) => {
        return sum + (Number(holding.value) || 0)
      }, 0) || 0

      const portfolioStats = {
        totalValue,
        totalAssets: portfolioData.holdingsAt?.length || 0,
        totalReturn: performanceMetrics.totalReturn,
        totalReturnPercent: performanceMetrics.totalReturnPercent,
        volatility: performanceMetrics.volatility,
        bestDay: performanceMetrics.bestDay,
        worstDay: performanceMetrics.worstDay,
        sharpeRatio: performanceMetrics.sharpeRatio
      }

      const result: PortfolioData = {
        series: series || [],
        holdings: includeHoldings ? (portfolioData.holdingsAt || []) : [],
        stats: portfolioStats,
        accounts: accountsData,
        assetBreakdown: assetBreakdownData,
        performance: performanceData,
        lastUpdated: new Date(),
        // Manter compatibilidade com componentes existentes
        monthlySeries: portfolioData.monthlySeries || [],
        dailySeries: portfolioData.dailySeries || null,
        holdingsAt: portfolioData.holdingsAt || []
      }

      // Cache the result
      CacheService.set(cacheKey, result, { ttl: CACHE_TTL, version: CACHE_VERSION })

      setData(result)
      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados do portfólio'
      setError(errorMessage)
      console.error('Error fetching portfolio data:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [userId, dateRange, granularity, includePerformance, includeHoldings, includeAccounts, includeAssetBreakdown, cacheKey])

  const refetch = useCallback(async () => {
    // Clear cache for this key
    CacheService.remove(cacheKey)
    return await fetchData()
  }, [cacheKey, fetchData])

  const invalidateCache = useCallback(() => {
    CacheService.invalidateByPrefix(`portfolio-data-${userId}`)
  }, [userId])

  // Initial data fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Memoize return value to prevent unnecessary re-renders
  const returnValue = useMemo(() => ({
    data,
    loading,
    error,
    refetch,
    invalidateCache,
    lastUpdated: data?.lastUpdated || null
  }), [data, loading, error, refetch, invalidateCache])

  return returnValue
}
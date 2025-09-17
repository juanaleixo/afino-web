/**
 * Hook que carrega todos os dados do dashboard em uma única chamada
 * Carrega dados do dashboard de forma otimizada com APIs separadas e leves
 * Elimina json_agg pesado e melhora performance
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { CacheService } from '@/lib/services/cacheService'

export interface DashboardData {
  user_context: {
    user_id: string
    plan: 'free' | 'premium'
    is_premium: boolean
    subscription: {
      id: string
      user_id: string
      status: string
      stripe_customer_id?: string
      stripe_subscription_id?: string
      premium_expires_at?: string
      current_period_end?: string
      cancel_at_period_end?: boolean
      created_at: string
      updated_at: string
    } | null
    features: {
      dailyData: boolean
      customPeriods: boolean
      advancedFilters: boolean
      projections: boolean
      multipleAccounts: boolean
      apiAccess: boolean
    }
    last_event_timestamp: number | null
    total_events: number
    accounts_count: number
  }
  holdings: Array<{
    asset_id: string
    symbol: string
    class: string
    label_ptbr: string
    units: number
    value: number
  }>
  monthly_series: Array<{
    month_eom: string
    total_value: number
  }>
  daily_series: Array<{
    date: string
    total_value: number
  }>
  portfolio_stats: {
    total_value: number
    total_assets: number
  }
  timestamp: number
  target_date?: string | null
  has_holdings_data?: boolean
}

const defaultData: DashboardData = {
  user_context: {
    user_id: '',
    plan: 'free',
    is_premium: false,
    subscription: null,
    features: {
      dailyData: false,
      customPeriods: false,
      advancedFilters: false,
      projections: false,
      multipleAccounts: false,
      apiAccess: false
    },
    last_event_timestamp: null,
    total_events: 0,
    accounts_count: 0
  },
  holdings: [],
  monthly_series: [],
  daily_series: [],
  portfolio_stats: {
    total_value: 0,
    total_assets: 0
  },
  timestamp: 0,
  target_date: null,
  has_holdings_data: false
}

// Cache simplificado usando CacheService
const ESSENTIAL_TTL = 5 * 60 * 1000 // 5 minutos
const TIMELINE_TTL = 10 * 60 * 1000   // 10 minutos

function getEssentialCacheKey(userId: string, date?: string): string {
  return CacheService.generateKey('dashboard-essential', userId, { date: date || 'current' })
}

function getTimelineCacheKey(userId: string, date?: string): string {
  return CacheService.generateKey('dashboard-timeline', userId, { date: date || 'current' })
}

function cacheEssentialData(userId: string, data: DashboardData, date?: string) {
  const key = getEssentialCacheKey(userId, date)
  CacheService.set(key, data, { ttl: ESSENTIAL_TTL })
}

function cacheTimelineData(userId: string, timelineData: { monthly_series: any[], daily_series: any[] }, date?: string) {
  const key = getTimelineCacheKey(userId, date)
  CacheService.set(key, timelineData, { ttl: TIMELINE_TTL })
}

function getCachedEssentialData(userId: string, date?: string): DashboardData | null {
  const key = getEssentialCacheKey(userId, date)
  return CacheService.get<DashboardData>(key)
}

function getCachedTimelineData(userId: string, date?: string): { monthly_series: any[], daily_series: any[] } | null {
  const key = getTimelineCacheKey(userId, date)
  return CacheService.get<{ monthly_series: any[], daily_series: any[] }>(key)
}

export function useDashboardBundle(date?: string) {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData>(defaultData)
  const [isLoading, setIsLoading] = useState(true)
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const loadEssentialData = useCallback(async () => {
    if (!user?.id) {
      setData(defaultData)
      setIsLoading(false)
      setTimelineLoading(false)
      return null
    }

    try {
      setError(null)
      const targetDate = date || new Date().toISOString().split('T')[0]!

      // Verificar cache primeiro
      const cachedEssential = getCachedEssentialData(user.id, date)
      const cachedTimeline = getCachedTimelineData(user.id, date)

      if (cachedEssential) {
        console.log('📦 Using cached essential data for user:', user.id)

        // Merge com timeline cache se disponível
        const initialData = cachedTimeline ? {
          ...cachedEssential,
          monthly_series: cachedTimeline.monthly_series,
          daily_series: cachedTimeline.daily_series
        } : cachedEssential

        setData(initialData)
        setIsLoading(false)
        return cachedEssential.user_context?.is_premium || false
      }

      setIsLoading(true)
      console.log('🔄 Loading essential dashboard data for user:', user.id)

      // Load essential data and holdings in parallel for better performance
      console.log('🔄 Loading dashboard data in parallel...')

      const [essentialResult, holdingsResult] = await Promise.all([
        supabase.rpc('api_dashboard_essential', { p_date: targetDate }),
        supabase.rpc('api_holdings_with_assets', { p_date: targetDate })
      ])

      if (essentialResult.error) {
        console.error('Dashboard essential error:', essentialResult.error)
        throw essentialResult.error
      }

      if (essentialResult.data) {
        console.log('✅ Essential dashboard data loaded successfully:', {
          user: essentialResult.data.user_context?.user_id,
          portfolio_value: essentialResult.data.portfolio_stats?.total_value || 0,
          has_holdings: essentialResult.data.has_holdings_data
        })

        // Process holdings data from parallel call
        let holdingsData: any[] = []
        if (essentialResult.data.has_holdings_data && holdingsResult.data && !holdingsResult.error) {
          holdingsData = holdingsResult.data
          console.log('✅ Holdings data loaded in parallel:', holdingsData.length, 'positions')
        }

        // Set essential data with existing timeline if available
        const existingTimeline = cachedTimeline || {
          monthly_series: [],
          daily_series: []
        }

        const initialData: DashboardData = {
          ...essentialResult.data,
          user_context: {
            ...essentialResult.data.user_context
          },
          holdings: holdingsData,
          ...existingTimeline
        }

        setData(initialData)
        setIsLoading(false)

        // Cache essential data
        cacheEssentialData(user.id, initialData, date)

        return essentialResult.data.user_context?.is_premium || false
      } else {
        console.log('No essential dashboard data returned, using default')
        setData(defaultData)
        setIsLoading(false)
        setTimelineLoading(false)
        return null
      }
    } catch (err) {
      console.error('Error loading essential dashboard data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      setData(defaultData)
      setIsLoading(false)
      setTimelineLoading(false)
      throw err
    }
  }, [user?.id, date])

  const loadTimelineData = useCallback(async (isPremium: boolean) => {
    if (!user?.id) {
      setTimelineLoading(false)
      return
    }

    try {
      const targetDate = date || new Date().toISOString().split('T')[0]!

      // Verificar cache de timeline primeiro
      const cachedTimeline = getCachedTimelineData(user.id, date)

      if (cachedTimeline) {
        console.log('📦 Using cached timeline data for user:', user.id)
        setData(prevData => ({
          ...prevData,
          monthly_series: cachedTimeline.monthly_series,
          daily_series: cachedTimeline.daily_series
        }))
        setTimelineLoading(false)
        return
      }

      setTimelineLoading(true)
      console.log('🔄 Loading timeline data for premium user:', isPremium)

      // Use existing timeline API but check if it has data first
      const timelineMetaResult = await supabase.rpc('api_dashboard_timeline', {
        p_date: targetDate,
        p_is_premium: isPremium
      })

      if (timelineMetaResult.error || !timelineMetaResult.data?.has_data) {
        console.log('📊 No timeline data available')
        setTimelineLoading(false)
        return
      }

      // Load timeline data in parallel for better performance
      const fromMonthly = new Date(targetDate)
      fromMonthly.setMonth(fromMonthly.getMonth() - 12)

      console.log('🔄 Loading timeline data in parallel...')

      // Execute parallel calls
      const promises = [
        supabase.rpc('api_portfolio_monthly', {
          p_from: fromMonthly.toISOString().split('T')[0],
          p_to: targetDate
        })
      ]

      // Add daily promise only if premium and has daily data
      if (isPremium && timelineMetaResult.data.daily_count > 0) {
        const fromDaily = new Date(targetDate)
        fromDaily.setMonth(fromDaily.getMonth() - 6)

        promises.push(
          supabase.from('portfolio_value_daily')
            .select('date, total_value')
            .eq('user_id', user.id)
            .gte('date', fromDaily.toISOString().split('T')[0])
            .lte('date', targetDate)
            .order('date', { ascending: false })
            .limit(180)
        )
      }

      // Execute all promises in parallel
      const results = await Promise.all(promises)

      const monthlyData = results[0]?.data || []
      let dailyData: any[] = []

      if (isPremium && results.length > 1 && results[1]?.data && !results[1]?.error) {
        dailyData = results[1].data
      }

      console.log('✅ Timeline data loaded successfully:', {
        monthly_points: monthlyData.length,
        daily_points: dailyData.length
      })

      // Merge timeline data with existing data
      const updatedData = {
        monthly_series: monthlyData.map((item: any) => ({
          month_eom: item.month_eom,
          total_value: item.total_value
        })),
        daily_series: dailyData.map((item: any) => ({
          date: item.date,
          total_value: item.total_value
        })),
        timestamp: Date.now()
      }

      // Update state and cache timeline data
      setData(prevData => ({
        ...prevData,
        ...updatedData
      }))

      // Cache timeline data separately
      cacheTimelineData(user.id, {
        monthly_series: updatedData.monthly_series,
        daily_series: updatedData.daily_series
      }, date)
    } catch (err) {
      console.error('Error loading timeline data:', err)
      // Don't set error - timeline is optional
    } finally {
      setTimelineLoading(false)
    }
  }, [user?.id, date])

  const loadDashboardData = useCallback(async () => {
    try {
      const isPremium = await loadEssentialData()

      // Load timeline data if essential data loaded successfully
      if (isPremium !== null) {
        await loadTimelineData(isPremium)
      }
    } catch (err) {
      // Error already handled in loadEssentialData
    }
  }, [loadEssentialData, loadTimelineData])

  const refresh = useCallback(async (forceRefresh = false) => {
    if (forceRefresh && user?.id) {
      // Limpar cache antes de recarregar
      try {
        CacheService.remove(getEssentialCacheKey(user.id, date))
        CacheService.remove(getTimelineCacheKey(user.id, date))
        console.log('🗑️ Cache cleared for forced refresh')
      } catch (error) {
        console.warn('Error clearing cache:', error)
      }
    }
    setHasLoadedOnce(false) // Reset flag para permitir reload
    return await loadDashboardData()
  }, [loadDashboardData, user?.id, date])

  const clearCache = useCallback(() => {
    if (user?.id) {
      try {
        // Limpar caches específicos do dashboard
        CacheService.remove(getEssentialCacheKey(user.id, date))
        CacheService.remove(getTimelineCacheKey(user.id, date))

        // Limpar todos os caches relacionados ao dashboard do usuário
        CacheService.invalidateByPrefix(`dashboard-essential-${user.id}`)
        CacheService.invalidateByPrefix(`dashboard-timeline-${user.id}`)

        console.log('🗑️ Dashboard cache cleared manually')
      } catch (error) {
        console.warn('Error clearing cache:', error)
      }
    }
  }, [user?.id, date])


  useEffect(() => {
    if (!hasLoadedOnce && user?.id) {
      loadDashboardData()
      setHasLoadedOnce(true)
    }
  }, [user?.id, date, hasLoadedOnce, loadDashboardData])

  // Reset hasLoadedOnce quando user ou date mudar
  useEffect(() => {
    setHasLoadedOnce(false)
  }, [user?.id, date])

  return {
    data,
    isLoading, // Essential data loading
    timelineLoading, // Timeline data loading (separate)
    error,
    refresh,
    clearCache
  }
}
/**
 * Hook que carrega todos os dados do dashboard em uma única chamada
 * Substitui múltiplas calls: api_user_context + api_holdings_with_assets + api_portfolio_monthly + api_portfolio_daily
 * Elimina preflights duplicadas e melhora performance
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

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
    accounts: Array<{
      id: string
      label: string
    }>
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
    accounts: []
  },
  holdings: [],
  monthly_series: [],
  daily_series: [],
  portfolio_stats: {
    total_value: 0,
    total_assets: 0
  },
  timestamp: 0
}

// Cache persistente com sessionStorage e TTL
interface CacheEntry {
  data: DashboardData
  essentialTimestamp: number
  timelineTimestamp: number
}

const ESSENTIAL_TTL = 5 * 60 * 1000 // 5 minutos (aumentado para reduzir chamadas)
const TIMELINE_TTL = 10 * 60 * 1000   // 10 minutos (aumentado para reduzir chamadas)
const CACHE_KEY_PREFIX = 'dashboard_cache_'

function getCacheKey(userId: string, date?: string): string {
  return `${CACHE_KEY_PREFIX}${userId}:${date || 'current'}`
}

function getCachedData(userId: string, date?: string): { 
  data: DashboardData | null
  essentialValid: boolean
  timelineValid: boolean
} {
  try {
    const key = getCacheKey(userId, date)
    const cached = sessionStorage.getItem(key)
    
    if (!cached) {
      return { data: null, essentialValid: false, timelineValid: false }
    }
    
    const entry: CacheEntry = JSON.parse(cached)
    const now = Date.now()
    const essentialValid = (now - entry.essentialTimestamp) < ESSENTIAL_TTL
    const timelineValid = (now - entry.timelineTimestamp) < TIMELINE_TTL
    
    if (!essentialValid && !timelineValid) {
      sessionStorage.removeItem(key)
      return { data: null, essentialValid: false, timelineValid: false }
    }
    
    return { data: entry.data, essentialValid, timelineValid }
  } catch (error) {
    console.warn('Error reading from cache:', error)
    return { data: null, essentialValid: false, timelineValid: false }
  }
}

function setCachedData(
  userId: string, 
  data: DashboardData, 
  date?: string, 
  type: 'essential' | 'timeline' | 'both' = 'both'
) {
  try {
    const key = getCacheKey(userId, date)
    const now = Date.now()
    
    let entry: CacheEntry
    let existing: CacheEntry | null = null
    
    // Tentar ler dados existentes
    try {
      const cachedData = sessionStorage.getItem(key)
      if (cachedData) {
        existing = JSON.parse(cachedData)
      }
    } catch (e) {
      console.warn('Error reading existing cache:', e)
    }
    
    if (existing && type === 'timeline') {
      // Apenas timeline
      entry = {
        ...existing,
        data: {
          ...existing.data,
          monthly_series: data.monthly_series,
          daily_series: data.daily_series,
          timestamp: data.timestamp
        },
        timelineTimestamp: now
      }
    } else if (existing && type === 'essential') {
      // Apenas essential, mantém timeline
      entry = {
        ...existing,
        data: {
          ...data,
          monthly_series: existing.data.monthly_series,
          daily_series: existing.data.daily_series
        },
        essentialTimestamp: now
      }
    } else {
      // Nova entrada ou ambos
      entry = {
        data,
        essentialTimestamp: now,
        timelineTimestamp: type === 'essential' ? (existing?.timelineTimestamp || 0) : now
      }
    }
    
    sessionStorage.setItem(key, JSON.stringify(entry))
  } catch (error) {
    console.warn('Error saving to cache:', error)
  }
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
      const cached = getCachedData(user.id, date)
      
      if (cached.essentialValid) {
        console.log('📦 Using cached essential data for user:', user.id)
        setData(cached.data!)
        setIsLoading(false)
        return cached.data!.user_context?.is_premium || false
      }

      setIsLoading(true)
      console.log('🔄 Loading essential dashboard data for user:', user.id)

      // Fast essential data call with retry on timeout
      let essentialData, essentialError
      let retryCount = 0
      const maxRetries = 2

      do {
        const result = await supabase.rpc('api_dashboard_essential', { 
          p_date: targetDate 
        })
        essentialData = result.data
        essentialError = result.error
        
        // If timeout error, wait a bit and retry
        if (essentialError?.code === '57014' && retryCount < maxRetries) {
          console.warn(`Dashboard timeout (attempt ${retryCount + 1}/${maxRetries + 1}), retrying...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))) // Progressive delay
          retryCount++
        } else {
          break
        }
      } while (essentialError?.code === '57014' && retryCount <= maxRetries)

      if (essentialError) {
        console.error('Dashboard essential error:', essentialError)
        throw essentialError
      }

      if (essentialData) {
        console.log('✅ Essential dashboard data loaded successfully:', {
          user: essentialData.user_context?.user_id,
          holdings_count: essentialData.holdings?.length || 0,
          portfolio_value: essentialData.portfolio_stats?.total_value || 0
        })
        
        // Set essential data with existing timeline if available
        const existingTimeline = cached.timelineValid ? {
          monthly_series: cached.data!.monthly_series,
          daily_series: cached.data!.daily_series
        } : {
          monthly_series: [],
          daily_series: []
        }
        
        const initialData: DashboardData = {
          ...essentialData,
          ...existingTimeline
        }
        
        setData(initialData)
        setIsLoading(false)
        
        // Cache essential data
        setCachedData(user.id, initialData, date, 'essential')
        
        return essentialData.user_context?.is_premium || false
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
      const cached = getCachedData(user.id, date)
      
      if (cached.timelineValid) {
        console.log('📦 Using cached timeline data for user:', user.id)
        setData(prevData => ({
          ...prevData,
          monthly_series: cached.data!.monthly_series,
          daily_series: cached.data!.daily_series
        }))
        setTimelineLoading(false)
        return
      }

      setTimelineLoading(true)
      console.log('🔄 Loading timeline data for premium user:', isPremium)

      // Separate timeline data call with retry on timeout
      let timelineData, timelineError
      let retryCount = 0
      const maxRetries = 1  // Fewer retries for timeline since it's optional

      do {
        const result = await supabase.rpc('api_dashboard_timeline', { 
          p_date: targetDate,
          p_is_premium: isPremium
        })
        timelineData = result.data
        timelineError = result.error
        
        // If timeout error, wait a bit and retry
        if (timelineError?.code === '57014' && retryCount < maxRetries) {
          console.warn(`Timeline timeout (attempt ${retryCount + 1}/${maxRetries + 1}), retrying...`)
          await new Promise(resolve => setTimeout(resolve, 1500)) // Wait before retry
          retryCount++
        } else {
          break
        }
      } while (timelineError?.code === '57014' && retryCount <= maxRetries)

      if (timelineError) {
        console.error('Dashboard timeline error:', timelineError)
        // Don't throw - timeline is optional
        return
      }

      if (timelineData) {
        console.log('✅ Timeline data loaded successfully:', {
          monthly_points: timelineData.monthly_series?.length || 0,
          daily_points: timelineData.daily_series?.length || 0
        })
        
        // Merge timeline data with existing data
        const updatedData = {
          monthly_series: timelineData.monthly_series || [],
          daily_series: timelineData.daily_series || [],
          timestamp: timelineData.timestamp || Date.now()
        }
        
        // Update state and cache in one operation
        setData(prevData => {
          const newData = {
            ...prevData,
            ...updatedData
          }
          setCachedData(user.id, newData, date, 'timeline')
          return newData
        })
      }
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

  const refresh = useCallback((forceRefresh = false) => {
    if (forceRefresh && user?.id) {
      // Limpar cache antes de recarregar
      const key = getCacheKey(user.id, date)
      try {
        sessionStorage.removeItem(key)
        console.log('🗑️ Cache cleared for forced refresh')
      } catch (error) {
        console.warn('Error clearing cache:', error)
      }
    }
    setHasLoadedOnce(false) // Reset flag para permitir reload
    loadDashboardData()
  }, [loadDashboardData, user?.id, date])

  const clearCache = useCallback(() => {
    if (user?.id) {
      const key = getCacheKey(user.id, date)
      try {
        sessionStorage.removeItem(key)
        console.log('🗑️ Cache cleared manually')
      } catch (error) {
        console.warn('Error clearing cache:', error)
      }
    }
  }, [user?.id, date])

  const cleanupExpiredCache = useCallback(() => {
    try {
      const keysToRemove: string[] = []
      
      // Iterar sobre todas as chaves do sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.startsWith(CACHE_KEY_PREFIX)) {
          try {
            const cached = sessionStorage.getItem(key)
            if (cached) {
              const entry: CacheEntry = JSON.parse(cached)
              const now = Date.now()
              const essentialExpired = (now - entry.essentialTimestamp) >= ESSENTIAL_TTL
              const timelineExpired = (now - entry.timelineTimestamp) >= TIMELINE_TTL
              
              // Remove se ambos expiraram
              if (essentialExpired && timelineExpired) {
                keysToRemove.push(key)
              }
            }
          } catch (e) {
            // Se não conseguir parsear, remover entrada corrompida
            keysToRemove.push(key)
          }
        }
      }
      
      // Remover entradas expiradas
      keysToRemove.forEach(key => {
        sessionStorage.removeItem(key)
      })
      
      if (keysToRemove.length > 0) {
        console.log(`🧹 Cleaned up ${keysToRemove.length} expired cache entries`)
      }
    } catch (error) {
      console.warn('Error cleaning up cache:', error)
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedOnce && user?.id) {
      // Limpeza automática de cache expirado apenas na primeira vez
      cleanupExpiredCache()
      loadDashboardData()
      setHasLoadedOnce(true)
    }
  }, [user?.id, date, hasLoadedOnce, cleanupExpiredCache, loadDashboardData])

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
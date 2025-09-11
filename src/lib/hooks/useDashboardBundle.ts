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

export function useDashboardBundle(date?: string) {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData>(defaultData)
  const [isLoading, setIsLoading] = useState(true)
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadEssentialData = useCallback(async () => {
    if (!user?.id) {
      setData(defaultData)
      setIsLoading(false)
      setTimelineLoading(false)
      return null
    }

    try {
      setIsLoading(true)
      setError(null)

      console.log('Loading essential dashboard data for user:', user.id)

      const targetDate = date || new Date().toISOString().split('T')[0]!

      // Fast essential data call
      const { data: essentialData, error: essentialError } = await supabase.rpc('api_dashboard_essential', { 
        p_date: targetDate 
      })

      if (essentialError) {
        console.error('Dashboard essential error:', essentialError)
        throw essentialError
      }

      if (essentialData) {
        console.log('Essential dashboard data loaded successfully:', {
          user: essentialData.user_context?.user_id,
          holdings_count: essentialData.holdings?.length || 0,
          portfolio_value: essentialData.portfolio_stats?.total_value || 0
        })
        
        // Set essential data with empty timeline initially
        const initialData: DashboardData = {
          ...essentialData,
          monthly_series: [],
          daily_series: []
        }
        
        setData(initialData)
        setIsLoading(false) // Essential data loaded
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
    try {
      setTimelineLoading(true)

      console.log('Loading timeline data for premium user:', isPremium)

      const targetDate = date || new Date().toISOString().split('T')[0]!

      // Separate timeline data call
      const { data: timelineData, error: timelineError } = await supabase.rpc('api_dashboard_timeline', { 
        p_date: targetDate,
        p_is_premium: isPremium
      })

      if (timelineError) {
        console.error('Dashboard timeline error:', timelineError)
        // Don't throw - timeline is optional
        return
      }

      if (timelineData) {
        console.log('Timeline data loaded successfully:', {
          monthly_points: timelineData.monthly_series?.length || 0,
          daily_points: timelineData.daily_series?.length || 0
        })
        
        // Merge timeline data with existing data
        setData(prevData => ({
          ...prevData,
          monthly_series: timelineData.monthly_series || [],
          daily_series: timelineData.daily_series || []
        }))
      }
    } catch (err) {
      console.error('Error loading timeline data:', err)
      // Don't set error - timeline is optional
    } finally {
      setTimelineLoading(false)
    }
  }, [date])

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

  const refresh = useCallback(() => {
    loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  return {
    data,
    isLoading, // Essential data loading
    timelineLoading, // Timeline data loading (separate)
    error,
    refresh
  }
}
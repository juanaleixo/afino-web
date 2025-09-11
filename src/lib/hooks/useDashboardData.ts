/**
 * Hook simples para carregar dados básicos do dashboard
 * Versão simplificada que usa funções existentes
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface DashboardData {
  userContext: {
    user_id: string
    plan: 'free' | 'premium'
    is_premium: boolean
    subscription: any
    features: any
  }
  portfolioStats: {
    total_value: number
    total_assets: number
    date: string
    has_data: boolean
  }
  holdings: Array<{
    asset_id: string
    symbol: string
    class: string
    label_ptbr: string
    units: number
    value: number
  }>
  timelinePreview: Array<{ date: string; total_value: number }>
}

export function useDashboardData(date?: string) {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setData(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Usar api_dashboard_data - query única otimizada
      const { data: dashboardResult, error: dashboardError } = await supabase.rpc('api_dashboard_data', { 
        p_date: date || new Date().toISOString().split('T')[0] 
      })

      if (dashboardError) {
        throw dashboardError
      }

      if (!dashboardResult) {
        throw new Error('Failed to load dashboard data')
      }

      // Mapear resultado direto da API consolidada
      const dashboardData: DashboardData = {
        userContext: dashboardResult.user_context,
        portfolioStats: dashboardResult.portfolio_stats,
        holdings: dashboardResult.holdings || [],
        timelinePreview: dashboardResult.timeline_preview || []
      }

      setData(dashboardData)
    } catch (err) {
      console.error('Error loading dashboard data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, date])

  const refresh = useCallback(() => loadData(), [loadData])

  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    data,
    isLoading,
    error,
    refresh
  }
}
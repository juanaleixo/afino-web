/**
 * Hook centralizado que usa api_user_context como fonte única de verdade
 * para verificações de premium e contexto do usuário
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { SubscriptionStatus } from '@/lib/services/subscription-service'

export interface UserContext {
  user_id: string
  plan: 'free' | 'premium'
  is_premium: boolean
  subscription: {
    id: string
    user_id: string
    status: SubscriptionStatus
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

const defaultContext: UserContext = {
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
}

export function useUserContext() {
  const { user } = useAuth()
  const [userContext, setUserContext] = useState<UserContext>(defaultContext)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadUserContext = useCallback(async () => {
    if (!user?.id) {
      setUserContext(defaultContext)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Usar api_user_context como fonte única
      const { data, error: rpcError } = await supabase.rpc('api_user_context')

      if (rpcError) {
        throw rpcError
      }

      if (data) {
        setUserContext(data as UserContext)
      } else {
        setUserContext(defaultContext)
      }
    } catch (err) {
      console.error('Error loading user context:', err)
      setError(err instanceof Error ? err.message : 'Failed to load user context')
      setUserContext(defaultContext)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const refresh = useCallback(() => loadUserContext(), [loadUserContext])

  useEffect(() => {
    loadUserContext()
  }, [loadUserContext])

  return {
    userContext,
    isLoading,
    error,
    refresh
  }
}

// Helper functions para compatibilidade
export function useIsPremium() {
  const { userContext, isLoading } = useUserContext()
  return {
    isPremium: userContext.is_premium,
    isLoading
  }
}

export function useUserFeatures() {
  const { userContext, isLoading } = useUserContext()
  return {
    features: userContext.features,
    isLoading
  }
}
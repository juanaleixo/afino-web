"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { cache } from '@/lib/cache'
import { subscriptionService, type Subscription } from '@/lib/services/subscription-service'
import { getStripe, SUBSCRIPTION_PLANS } from '@/lib/stripe'
import { toast } from 'sonner'

export type UserPlan = 'free' | 'premium'

interface UserPlanData {
  plan: UserPlan
  isPremium: boolean
  subscription: Subscription | null
  features: {
    dailyData: boolean
    customPeriods: boolean
    advancedFilters: boolean
    projections: boolean
    multipleAccounts: boolean
    apiAccess: boolean
  }
  isLoading: boolean
  error: string | null
}

const DEFAULT_USER_PLAN: UserPlanData = {
  plan: 'free',
  isPremium: false,
  subscription: null,
  features: {
    dailyData: false,
    customPeriods: false,
    advancedFilters: false,
    projections: false,
    multipleAccounts: false,
    apiAccess: false
  },
  isLoading: true,
  error: null
}

interface UserPlanContextType extends UserPlanData {
  refreshPlan: () => Promise<void>
  // Stripe actions
  createCheckoutSession: (priceId: string) => Promise<void>
  createPortalSession: () => Promise<void>
  cancelSubscription: () => Promise<void>
}

const UserPlanContext = createContext<UserPlanContextType | undefined>(undefined)

// Global cache to prevent multiple simultaneous calls
const ongoingCalls = new Map<string, Promise<{plan: UserPlan, subscription: Subscription | null}>>()

async function fetchUserPlanData(userId: string): Promise<{plan: UserPlan, subscription: Subscription | null}> {
  const cacheKey = `user_plan_data:${userId}`
  
  // Check cache first
  const cached = cache.get<{plan: UserPlan, subscription: Subscription | null}>(cacheKey)
  if (cached) {
    console.log(`User plan data cache HIT for ${userId}`)
    return cached
  }

  // Check if there's already an ongoing call for this user
  if (ongoingCalls.has(userId)) {
    console.log(`Waiting for ongoing user plan data call for ${userId}`)
    return await ongoingCalls.get(userId)!
  }

  console.log(`User plan data cache MISS for ${userId} - making API call`)

  // Create the promise and store it
  const promise = (async () => {
    try {
      // Use the subscription service for consistent data fetching
      const [subscription, isPremiumResult] = await Promise.all([
        subscriptionService.getUserSubscription(userId),
        subscriptionService.isPremiumUser(userId)
      ])
      
      const plan: UserPlan = isPremiumResult ? 'premium' : 'free'
      const result = { plan, subscription }
      
      // Cache for 10 minutes (plan changes are infrequent)
      cache.set(cacheKey, result, { ttl: 10 * 60 * 1000 })
      
      return result
    } catch (error) {
      console.warn('Erro ao verificar dados do usuário, usando free como padrão:', error)
      return { plan: 'free' as UserPlan, subscription: null }
    } finally {
      // Remove from ongoing calls
      ongoingCalls.delete(userId)
    }
  })()

  ongoingCalls.set(userId, promise)
  return await promise
}

interface UserPlanProviderProps {
  children: ReactNode
}

export function UserPlanProvider({ children }: UserPlanProviderProps) {
  const { user } = useAuth()
  const [userPlanData, setUserPlanData] = useState<UserPlanData>(DEFAULT_USER_PLAN)

  const loadUserPlan = async (forceRefresh = false) => {
    if (!user?.id) {
      setUserPlanData({
        ...DEFAULT_USER_PLAN,
        isLoading: false
      })
      return
    }

    try {
      setUserPlanData(prev => ({ ...prev, isLoading: true, error: null }))
      
      if (forceRefresh) {
        // Clear cache if forcing refresh
        cache.delete(`user_plan_data:${user.id}`)
      }

      const { plan, subscription } = await fetchUserPlanData(user.id)
      const isPremium = plan === 'premium'
      
      setUserPlanData({
        plan,
        isPremium,
        subscription,
        features: {
          dailyData: isPremium,
          customPeriods: isPremium,
          advancedFilters: isPremium,
          projections: isPremium,
          multipleAccounts: isPremium,
          apiAccess: isPremium
        },
        isLoading: false,
        error: null
      })
    } catch (error) {
      console.error('Error loading user plan:', error)
      setUserPlanData({
        ...DEFAULT_USER_PLAN,
        isLoading: false,
        error: 'Failed to load subscription data'
      })
    }
  }

  const refreshPlan = async () => {
    await loadUserPlan(true)
  }

  // Stripe actions
  const createCheckoutSession = async (priceId: string) => {
    if (!user?.id) {
      toast.error('Você precisa estar logado para fazer isso')
      return
    }

    try {
      setUserPlanData(prev => ({ ...prev, isLoading: true }))
      
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user.id,
          successUrl: `${window.location.origin}/dashboard/subscription?success=true`,
          cancelUrl: `${window.location.origin}/dashboard/pricing?canceled=true`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      const stripe = await getStripe()
      if (!stripe) {
        throw new Error('Stripe not loaded')
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      })

      if (stripeError) {
        throw new Error(stripeError.message)
      }

    } catch (err) {
      console.error('Error creating checkout session:', err)
      toast.error('Erro ao criar sessão de pagamento')
    } finally {
      setUserPlanData(prev => ({ ...prev, isLoading: false }))
    }
  }

  const createPortalSession = async () => {
    if (!user?.id) {
      toast.error('Você precisa estar logado para fazer isso')
      return
    }

    try {
      setUserPlanData(prev => ({ ...prev, isLoading: true }))

      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          returnUrl: `${window.location.origin}/dashboard/subscription`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal session')
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url

    } catch (err) {
      console.error('Error creating portal session:', err)
      toast.error('Erro ao abrir portal de gerenciamento')
    } finally {
      setUserPlanData(prev => ({ ...prev, isLoading: false }))
    }
  }

  const cancelSubscription = async () => {
    if (!user?.id) {
      toast.error('Você precisa estar logado para fazer isso')
      return
    }

    try {
      setUserPlanData(prev => ({ ...prev, isLoading: true }))
      
      const success = await subscriptionService.cancelSubscription(user.id)
      
      if (success) {
        toast.success('Assinatura cancelada com sucesso')
        await refreshPlan() // Refresh data
      } else {
        throw new Error('Failed to cancel subscription')
      }

    } catch (err) {
      console.error('Error canceling subscription:', err)
      toast.error('Erro ao cancelar assinatura')
    } finally {
      setUserPlanData(prev => ({ ...prev, isLoading: false }))
    }
  }

  useEffect(() => {
    loadUserPlan()
  }, [user?.id])

  const contextValue: UserPlanContextType = {
    ...userPlanData,
    refreshPlan,
    createCheckoutSession,
    createPortalSession,
    cancelSubscription
  }

  return (
    <UserPlanContext.Provider value={contextValue}>
      {children}
    </UserPlanContext.Provider>
  )
}

export function useUserPlan(): UserPlanContextType {
  const context = useContext(UserPlanContext)
  if (context === undefined) {
    throw new Error('useUserPlan must be used within a UserPlanProvider')
  }
  return context
}

// Helper function to clear user plan cache (useful after plan updates)
export function clearUserPlanCache(userId: string) {
  cache.delete(`user_plan_data:${userId}`)
}
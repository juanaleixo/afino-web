"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { cache } from '@/lib/cache'

export type UserPlan = 'free' | 'premium'

interface UserPlanData {
  plan: UserPlan
  isPremium: boolean
  features: {
    dailyData: boolean
    customPeriods: boolean
    advancedFilters: boolean
    projections: boolean
    multipleAccounts: boolean
    apiAccess: boolean
  }
  isLoading: boolean
}

const DEFAULT_USER_PLAN: UserPlanData = {
  plan: 'free',
  isPremium: false,
  features: {
    dailyData: false,
    customPeriods: false,
    advancedFilters: false,
    projections: false,
    multipleAccounts: false,
    apiAccess: false
  },
  isLoading: true
}

interface UserPlanContextType extends UserPlanData {
  refreshPlan: () => Promise<void>
}

const UserPlanContext = createContext<UserPlanContextType | undefined>(undefined)

// Global cache to prevent multiple simultaneous calls
const ongoingCalls = new Map<string, Promise<UserPlan>>()

async function fetchUserPlan(userId: string): Promise<UserPlan> {
  const cacheKey = `user_plan:${userId}`
  
  // Check cache first
  const cached = cache.get<UserPlan>(cacheKey)
  if (cached) {
    console.log(`User plan cache HIT for ${userId}`)
    return cached
  }

  // Check if there's already an ongoing call for this user
  if (ongoingCalls.has(userId)) {
    console.log(`Waiting for ongoing user plan call for ${userId}`)
    return await ongoingCalls.get(userId)!
  }

  console.log(`User plan cache MISS for ${userId} - making API call`)

  // Create the promise and store it
  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('plan')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.warn('Erro ao carregar plano do usuário, usando free como padrão:', error)
        return 'free'
      }

      const plan = data?.plan || 'free'
      
      // Cache for 10 minutes (plan changes are infrequent)
      cache.set(cacheKey, plan, { ttl: 10 * 60 * 1000 })
      
      return plan
    } catch (error) {
      console.warn('Erro ao verificar plano do usuário, usando free como padrão:', error)
      return 'free'
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
      if (forceRefresh) {
        // Clear cache if forcing refresh
        cache.delete(`user_plan:${user.id}`)
      }

      const plan = await fetchUserPlan(user.id)
      const isPremium = plan === 'premium'
      
      setUserPlanData({
        plan: isPremium ? 'premium' : 'free',
        isPremium,
        features: {
          dailyData: isPremium,
          customPeriods: isPremium,
          advancedFilters: isPremium,
          projections: isPremium,
          multipleAccounts: isPremium,
          apiAccess: isPremium
        },
        isLoading: false
      })
    } catch (error) {
      console.error('Error loading user plan:', error)
      setUserPlanData({
        ...DEFAULT_USER_PLAN,
        isLoading: false
      })
    }
  }

  const refreshPlan = async () => {
    await loadUserPlan(true)
  }

  useEffect(() => {
    loadUserPlan()
  }, [user?.id])

  const contextValue: UserPlanContextType = {
    ...userPlanData,
    refreshPlan
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
  cache.delete(`user_plan:${userId}`)
}
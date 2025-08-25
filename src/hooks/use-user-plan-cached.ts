import { useState, useEffect } from 'react'
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
  }
}

async function fetchUserPlan(userId: string): Promise<UserPlan> {
  const cacheKey = `user_plan:${userId}`
  
  // Check cache first
  const cached = cache.get<UserPlan>(cacheKey)
  if (cached) {
    return cached
  }

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
  }
}

export function useUserPlan(): UserPlanData {
  const { user } = useAuth()
  const [userPlan, setUserPlan] = useState<UserPlanData>(DEFAULT_USER_PLAN)

  useEffect(() => {
    if (!user?.id) {
      setUserPlan(DEFAULT_USER_PLAN)
      return
    }

    const loadUserPlan = async () => {
      try {
        const plan = await fetchUserPlan(user.id)
        const isPremium = plan === 'premium'
        
        setUserPlan({
          plan: isPremium ? 'premium' : 'free',
          isPremium,
          features: {
            dailyData: isPremium,
            customPeriods: isPremium,
            advancedFilters: isPremium,
            projections: isPremium,
            multipleAccounts: isPremium,
            apiAccess: isPremium
          }
        })
      } catch (error) {
        console.error('Error loading user plan:', error)
        setUserPlan(DEFAULT_USER_PLAN)
      }
    }

    loadUserPlan()
  }, [user?.id])

  return userPlan
}

// Helper function to clear user plan cache (useful after plan updates)
export function clearUserPlanCache(userId: string) {
  cache.delete(`user_plan:${userId}`)
}
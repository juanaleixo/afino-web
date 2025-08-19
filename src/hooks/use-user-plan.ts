import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface UserPlan {
  plan: 'free' | 'premium'
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

export function useUserPlan(): UserPlan {
  const { user } = useAuth()
  const [userPlan, setUserPlan] = useState<UserPlan>({
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
  })

  useEffect(() => {
    if (!user?.id) return

    const checkUserPlan = async () => {
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('plan')
          .eq('user_id', user.id)
          .single()

        const isPremium = profile?.plan === 'premium'
        
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
        console.error('Error checking user plan:', error)
        // Default to free plan on error
        setUserPlan({
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
        })
      }
    }

    checkUserPlan()
  }, [user?.id])

  return userPlan
}
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export type UserPlan = 'free' | 'premium'

interface UseUserPlanReturn {
  plan: UserPlan
  isLoading: boolean
  isPremium: boolean
  updatePlan: (newPlan: UserPlan) => Promise<void>
  refetch: () => Promise<void>
}

export function useUserPlan(): UseUserPlanReturn {
  const { user } = useAuth()
  const [plan, setPlan] = useState<UserPlan>('free')
  const [isLoading, setIsLoading] = useState(true)

  const fetchUserPlan = async () => {
    if (!user) {
      setPlan('free')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('plan')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.warn('Erro ao carregar plano do usuário, usando free como padrão:', error)
        setPlan('free')
      } else {
        setPlan(data?.plan || 'free')
      }
    } catch (error) {
      console.warn('Erro ao verificar plano do usuário, usando free como padrão:', error)
      setPlan('free')
    } finally {
      setIsLoading(false)
    }
  }

  const updatePlan = async (newPlan: UserPlan) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          plan: newPlan
        })

      if (error) {
        throw error
      }

      setPlan(newPlan)
    } catch (error) {
      console.error('Erro ao atualizar plano:', error)
      throw error
    }
  }

  const refetch = async () => {
    await fetchUserPlan()
  }

  useEffect(() => {
    fetchUserPlan()
  }, [user])

  return {
    plan,
    isLoading,
    isPremium: plan === 'premium',
    updatePlan,
    refetch
  }
} 
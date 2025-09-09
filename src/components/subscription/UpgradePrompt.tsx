'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserPlan } from '@/contexts/UserPlanContext'
import { useAuth } from '@/lib/auth'
import { Crown, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface UpgradePromptProps {
  feature?: string
  compact?: boolean
  className?: string
}

export function UpgradePrompt({ feature, compact = false, className }: UpgradePromptProps) {
  const { isPremium } = useUserPlan()
  const { user } = useAuth()
  const router = useRouter()

  const handleUpgradeClick = () => {
    if (user) {
      router.push('/dashboard/pricing')
    } else {
      window.location.href = '/pricing'
    }
  }

  if (isPremium) {
    return null
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200 ${className}`}>
        <Crown className="h-5 w-5 text-yellow-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-900">
            {feature ? `${feature} é premium` : 'Recurso Premium'}
          </p>
          <p className="text-xs text-yellow-700">
            Faça upgrade para desbloquear
          </p>
        </div>
        <Button 
          size="sm" 
          onClick={handleUpgradeClick}
          className="bg-yellow-600 hover:bg-yellow-700"
        >
          Upgrade
        </Button>
      </div>
    )
  }

  return (
    <Card className={`border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 ${className}`}>
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-2">
          <Crown className="h-6 w-6 text-yellow-600" />
        </div>
        <CardTitle className="text-yellow-900">
          {feature ? `${feature} é Premium` : 'Desbloqueie o Premium'}
        </CardTitle>
        <CardDescription className="text-yellow-700">
          {feature 
            ? `Para usar ${feature.toLowerCase()}, você precisa do plano premium`
            : 'Acesse funcionalidades avançadas com o plano premium'
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="text-center space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-yellow-800">
            <Sparkles className="h-4 w-4" />
            <span>Timeline diária com histórico completo</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-yellow-800">
            <Sparkles className="h-4 w-4" />
            <span>Análises avançadas de performance</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-yellow-800">
            <Sparkles className="h-4 w-4" />
            <span>Métricas de diversificação</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-yellow-800">
            <Sparkles className="h-4 w-4" />
            <span>14 dias de teste grátis</span>
          </div>
        </div>

        <Button 
          onClick={handleUpgradeClick}
          className="w-full bg-yellow-600 hover:bg-yellow-700"
        >
          <Crown className="h-4 w-4 mr-2" />
          Ver Planos Premium
        </Button>
      </CardContent>
    </Card>
  )
}
"use client"

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Crown, Check, X } from 'lucide-react'
import Link from 'next/link'
import { useUserPlan } from '@/contexts/UserPlanContext'

interface PlanStatusProps {
  showUpgradeButton?: boolean
  className?: string
}

export default function PlanStatus({ showUpgradeButton = true, className = '' }: PlanStatusProps) {
  const { plan, isLoading, isPremium } = useUserPlan()

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Badge variant={isPremium ? "default" : "secondary"} className="flex items-center space-x-1">
        <Crown className={`h-3 w-3 ${isPremium ? 'text-yellow-300' : 'text-gray-400'}`} />
        <span className="capitalize">{plan}</span>
      </Badge>
      
      {showUpgradeButton && !isPremium && (
        <Button size="sm" variant="outline" asChild>
          <Link href="/pricing">
            <Crown className="h-3 w-3 mr-1" />
            Upgrade
          </Link>
        </Button>
      )}
    </div>
  )
}

interface PlanFeatureProps {
  feature: string
  isAvailable: boolean
}

export function PlanFeature({ feature, isAvailable }: PlanFeatureProps) {
  return (
    <div className="flex items-center space-x-2">
      {isAvailable ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-red-500" />
      )}
      <span className={isAvailable ? 'text-foreground' : 'text-muted-foreground'}>
        {feature}
      </span>
    </div>
  )
}

interface PlanComparisonProps {
  className?: string
}

export function PlanComparison({ className = '' }: PlanComparisonProps) {
  const { isPremium } = useUserPlan()

  const features = [
    { name: 'Série mensal do patrimônio', free: true, premium: true },
    { name: 'Série diária do patrimônio', free: false, premium: true },
    { name: 'Snapshot por ativo', free: true, premium: true },
    { name: 'Detalhamento por conta', free: false, premium: true },
    { name: 'Gráficos avançados', free: false, premium: true },
    { name: 'Relatórios detalhados', free: false, premium: true },
  ]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Crown className="h-5 w-5" />
          <span>Funcionalidades por Plano</span>
        </CardTitle>
        <CardDescription>
          Compare as funcionalidades disponíveis em cada plano
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm">{feature.name}</span>
              <div className="flex items-center space-x-4">
                <PlanFeature 
                  feature="Free" 
                  isAvailable={feature.free} 
                />
                <PlanFeature 
                  feature="Premium" 
                  isAvailable={feature.premium} 
                />
              </div>
            </div>
          ))}
        </div>
        
        {!isPremium && (
          <div className="mt-6 pt-4 border-t">
            <Button asChild className="w-full">
              <Link href="/pricing">
                <Crown className="h-4 w-4 mr-2" />
                Atualizar para Premium
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 
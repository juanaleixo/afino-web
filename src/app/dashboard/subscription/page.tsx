'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useUserPlan } from '@/contexts/UserPlanContext'
import { SUBSCRIPTION_PLANS, formatPrice } from '@/lib/stripe'
import { formatDate } from '@/lib/utils/formatters'
import { 
  Crown, 
  Calendar, 
  CreditCard, 
  Settings, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react'

export default function SubscriptionPage() {
  const { 
    subscription, 
    isPremium, 
    isLoading, 
    error
  } = useUserPlan()
  
  const currentPlan = isPremium ? SUBSCRIPTION_PLANS.PREMIUM : SUBSCRIPTION_PLANS.FREE
  const isTrialing = subscription?.status === 'trialing'
  const willCancel = subscription?.cancel_at_period_end

  const handleUpgrade = () => {
    window.open('https://billing.stripe.com/p/login/test_6oE9CSaO17Zb9SU144', '_blank')
  }

  const handleManageSubscription = () => {
    window.open('https://billing.stripe.com/p/login/test_6oE9CSaO17Zb9SU144', '_blank')
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Assinatura</h1>
          <p className="text-muted-foreground">
            Gerencie seu plano e método de pagamento
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Erro ao carregar assinatura</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Current Plan Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isPremium ? (
                <Crown className="h-6 w-6 text-yellow-500" />
              ) : (
                <CreditCard className="h-6 w-6 text-gray-500" />
              )}
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plano {currentPlan.name}
                  <Badge variant={isPremium ? 'default' : 'secondary'}>
                    {isPremium ? 'Premium' : 'Free'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {formatPrice(currentPlan.price)}/mês
                </CardDescription>
              </div>
            </div>
            
            {subscription?.status && (
              <Badge 
                variant={subscription.status === 'active' ? 'default' : 'secondary'}
                className={
                  subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                  subscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                  subscription.status === 'past_due' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }
              >
                {subscription.status === 'active' && 'Ativo'}
                {subscription.status === 'trialing' && 'Em teste'}
                {subscription.status === 'past_due' && 'Pendente'}
                {subscription.status === 'canceled' && 'Cancelado'}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Trial Information */}
          {isTrialing && subscription?.trial_end && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Período de Teste Ativo
                </p>
                <p className="text-sm text-blue-700">
                  Termina em {formatDate(subscription.trial_end)}
                </p>
              </div>
            </div>
          )}

          {/* Cancellation Notice */}
          {willCancel && subscription?.current_period_end && (
            <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-900">
                  Assinatura será cancelada
                </p>
                <p className="text-sm text-orange-700">
                  O acesso premium será mantido até {formatDate(subscription.current_period_end)}
                </p>
              </div>
            </div>
          )}

          {/* Subscription Details */}
          {subscription && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>Status: <strong>{subscription.status}</strong></span>
              </div>
              
              {subscription.current_period_end && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>
                    {willCancel ? 'Expira em: ' : 'Próxima cobrança: '}
                    <strong>{formatDate(subscription.current_period_end)}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Plan Features */}
          <div>
            <h4 className="font-medium mb-3">Recursos inclusos:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {currentPlan.features.map((feature, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      {!isPremium && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade para Premium</CardTitle>
            <CardDescription>
              Desbloqueie recursos avançados e tenha acesso completo à plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2 text-gray-600">Plano Free (atual)</h4>
                <ul className="space-y-1 text-sm">
                  {SUBSCRIPTION_PLANS.FREE.features.slice(0, 3).map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2 text-primary">Plano Premium</h4>
                <ul className="space-y-1 text-sm">
                  {SUBSCRIPTION_PLANS.PREMIUM.features.slice(1, 4).map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Crown className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-blue-600/10 rounded-lg p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Upgrade para Premium</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(SUBSCRIPTION_PLANS.PREMIUM.price)}/mês • 14 dias grátis
                  </p>
                </div>
                <Button 
                  onClick={handleUpgrade}
                  className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade Agora
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Management Actions */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Assinatura</CardTitle>
            <CardDescription>
              Acesse o portal do cliente para gerenciar seu plano e forma de pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleManageSubscription}
              variant="outline"
              className="w-full md:w-auto"
            >
              <Settings className="h-4 w-4 mr-2" />
              Abrir Portal do Cliente
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              No portal você pode atualizar sua forma de pagamento, baixar faturas e cancelar sua assinatura.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
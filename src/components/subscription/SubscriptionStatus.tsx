'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserContext } from '@/lib/hooks/useUserContext'
import { getPlanName, isTrialActive, getTrialDaysRemaining } from '@/lib/utils/subscription-helpers'
import { useAuth } from '@/lib/auth'
import { formatPrice, SUBSCRIPTION_PLANS } from '@/lib/stripe'
import { formatDate } from '@/lib/utils/formatters'
import { Loader2, Crown, Settings, CreditCard, Calendar, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function SubscriptionStatus() {
  const { userContext, isLoading } = useUserContext()
  const subscription = userContext.subscription
  const isPremium = userContext.is_premium
  const { user } = useAuth()
  const router = useRouter()

  const handleUpgradeClick = () => {
    if (user) {
      router.push('/dashboard/pricing')
    } else {
      window.location.href = '/pricing'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const planName = getPlanName(subscription)
  const isOnTrial = isTrialActive(subscription)
  const trialDays = getTrialDaysRemaining(subscription)
  
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isPremium ? (
                <>
                  <Crown className="h-5 w-5 text-yellow-500" />
                  Plano {planName}
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 text-gray-500" />
                  Plano {planName}
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isPremium 
                ? 'Você tem acesso a todas as funcionalidades premium'
                : 'Faça upgrade para acessar funcionalidades avançadas'
              }
            </CardDescription>
          </div>
          <Badge 
            variant={isPremium ? 'default' : 'secondary'}
            className={isPremium ? 'bg-yellow-100 text-yellow-800' : ''}
          >
            {isPremium ? 'Premium' : 'Free'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Trial Information */}
        {isOnTrial && (
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Período de Teste Ativo
              </p>
              <p className="text-sm text-blue-700">
                {trialDays > 0 
                  ? `${trialDays} dia${trialDays !== 1 ? 's' : ''} restante${trialDays !== 1 ? 's' : ''}`
                  : 'Último dia de teste'
                }
              </p>
            </div>
          </div>
        )}

        {/* Subscription Details */}
        {subscription && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>
                Status: <strong className="text-gray-900">{subscription.status}</strong>
              </span>
            </div>

            {subscription.current_period_end && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>
                  {subscription.cancel_at_period_end 
                    ? 'Expira em: '
                    : 'Próxima cobrança: '
                  }
                  <strong className="text-gray-900">
                    {formatDate(subscription.current_period_end)}
                  </strong>
                </span>
              </div>
            )}

            {subscription.cancel_at_period_end && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-900">
                    Assinatura Cancelada
                  </p>
                  <p className="text-sm text-orange-700">
                    Você manterá o acesso premium até a data de expiração.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Current Plan Features */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Recursos do seu plano:
          </h4>
          <ul className="text-sm text-gray-600 space-y-1">
            {(isPremium ? SUBSCRIPTION_PLANS.PREMIUM : SUBSCRIPTION_PLANS.FREE).features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          {!isPremium && (
            <Button 
              onClick={handleUpgradeClick}
              className="w-full"
            >
              <Crown className="h-4 w-4 mr-2" />
              Fazer Upgrade para Premium
            </Button>
          )}
          
          {subscription && (
            <Button 
              variant="outline" 
              onClick={() => window.open('https://billing.stripe.com/p/login/test_6oE9CSaO17Zb9SU144', '_blank')}
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Gerenciar Assinatura
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
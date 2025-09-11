'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUserContextFromProvider } from '@/contexts/UserContextProvider'
import { formatPrice, SUBSCRIPTION_PLANS, type PlanType } from '@/lib/stripe'
import { Crown, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PricingCardProps {
  planType: PlanType
  popular?: boolean
  className?: string
}

export function PricingCard({ planType, popular = false, className }: PricingCardProps) {
  const { userContext, isLoading: contextLoading } = useUserContextFromProvider()
  const isPremium = userContext.is_premium
  
  const plan = SUBSCRIPTION_PLANS[planType]
  const isCurrent = (planType === 'PREMIUM' && isPremium) || (planType === 'FREE' && !isPremium)
  const isPremiumPlan = planType === 'PREMIUM'

  const handleUpgrade = () => {
    if (planType === 'FREE' || isCurrent) return
    
    // Redirect to pricing page with Stripe Pricing Table
    window.location.href = '/dashboard/pricing'
  }

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-200",
      popular && "ring-2 ring-yellow-500 shadow-lg scale-105",
      className
    )}>
      {popular && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-center py-2 text-sm font-medium">
          Mais Popular
        </div>
      )}

      <CardHeader className={cn("text-center", popular && "pt-12")}>
        <div className="flex items-center justify-center gap-2 mb-2">
          {isPremiumPlan && <Crown className="h-6 w-6 text-yellow-500" />}
          <CardTitle className="text-2xl">{plan.name}</CardTitle>
        </div>
        
        <div className="space-y-2">
          <div className="text-4xl font-bold">
            {formatPrice(plan.price)}
            <span className="text-lg font-normal text-gray-600">/mês</span>
          </div>
          
          {plan.trialDays && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {plan.trialDays} dias grátis
            </Badge>
          )}
          
          {isCurrent && (
            <Badge className="bg-green-100 text-green-800">
              Plano Atual
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Features */}
        <div className="space-y-3">
          {plan.features.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))}
        </div>

        {/* Limitations */}
        {plan.limitations.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-2">Limitações:</p>
            <div className="space-y-2">
              {plan.limitations.map((limitation, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span className="text-sm text-gray-500">{limitation}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA Button */}
        <Button
          onClick={handleUpgrade}
          disabled={isCurrent || contextLoading}
          className={cn(
            "w-full",
            isPremiumPlan && "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600",
            isCurrent && "opacity-50 cursor-not-allowed"
          )}
          variant={isPremiumPlan ? "default" : "outline"}
        >
          {contextLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isCurrent 
            ? 'Plano Atual'
            : planType === 'FREE' 
            ? 'Gratuito'
            : 'Começar Teste Grátis'
          }
        </Button>

        {isPremiumPlan && !isCurrent && (
          <p className="text-xs text-center text-gray-500">
            Cancele a qualquer momento. Sem compromisso.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
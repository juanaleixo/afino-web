'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PricingCard } from '@/components/subscription/PricingCard'
import { useUserPlan } from '@/contexts/UserPlanContext'
import { SUBSCRIPTION_PLANS } from '@/lib/stripe'
import { 
  Crown, 
  ArrowLeft, 
  CheckCircle, 
  Loader2,
  Zap,
  TrendingUp,
  Shield,
  Clock
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPricingPage() {
  const { subscription, isPremium, isLoading } = useUserPlan()

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  const currentPlan = isPremium ? 'Premium' : 'Free'

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Planos e Preços</h1>
            <p className="text-muted-foreground">
              Escolha o plano ideal para suas necessidades
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Plano atual</p>
          <Badge variant={isPremium ? 'default' : 'secondary'} className="text-sm">
            {isPremium && <Crown className="h-3 w-3 mr-1" />}
            {currentPlan}
          </Badge>
        </div>
      </div>

      {/* Current Status Alert */}
      {isPremium && subscription && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg">Você já é Premium!</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Aproveite todos os recursos avançados da plataforma.
            </p>
            <Link href="/dashboard/subscription">
              <Button variant="outline" size="sm">
                Gerenciar Assinatura
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Pricing Cards */}
      <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
        <PricingCard 
          planType="FREE" 
          className={!isPremium ? "ring-2 ring-primary" : ""}
        />
        <PricingCard 
          planType="PREMIUM" 
          popular={!isPremium}
          className={isPremium ? "ring-2 ring-yellow-500" : ""}
        />
      </div>

      {/* Why Upgrade Section (only for free users) */}
      {!isPremium && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">
              Por que fazer upgrade para Premium?
            </h2>
            <p className="text-muted-foreground">
              Desbloqueie todo o potencial da plataforma Afino
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-3 bg-blue-100 rounded-full w-fit">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Análises Avançadas</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">
                  Timeline diária, métricas de diversificação e relatórios detalhados 
                  para tomar decisões mais inteligentes.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-3 bg-green-100 rounded-full w-fit">
                  <Zap className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-lg">Recursos Exclusivos</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">
                  Acesso antecipado a novas funcionalidades e ferramentas 
                  avançadas de análise de portfolio.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-3 bg-purple-100 rounded-full w-fit">
                  <Shield className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-lg">Suporte Prioritário</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">
                  Atendimento prioritário e suporte especializado para 
                  otimizar seu uso da plataforma.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">Comparação Detalhada</h3>
          <p className="text-muted-foreground">
            Veja as diferenças entre os planos Free e Premium
          </p>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 font-semibold">Funcionalidade</th>
                    <th className="text-center py-3 font-semibold">Free</th>
                    <th className="text-center py-3 font-semibold">Premium</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  <tr className="border-b">
                    <td className="py-3">Registro de ativos</td>
                    <td className="py-3 text-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    </td>
                    <td className="py-3 text-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    </td>
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="py-3">Timeline histórica</td>
                    <td className="py-3 text-center text-sm text-muted-foreground">Mensal</td>
                    <td className="py-3 text-center text-sm font-medium text-primary">Diária</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3">Análises de performance</td>
                    <td className="py-3 text-center text-sm text-muted-foreground">Básicas</td>
                    <td className="py-3 text-center text-sm font-medium text-primary">Avançadas</td>
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <td className="py-3">Suporte</td>
                    <td className="py-3 text-center text-sm text-muted-foreground">Email</td>
                    <td className="py-3 text-center text-sm font-medium text-primary">Prioritário</td>
                  </tr>
                  <tr>
                    <td className="py-3">Novas funcionalidades</td>
                    <td className="py-3 text-center text-sm text-muted-foreground">Padrão</td>
                    <td className="py-3 text-center text-sm font-medium text-primary">Acesso antecipado</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trial Info */}
      {!isPremium && (
        <Card className="bg-gradient-to-r from-primary/10 to-blue-600/10 border-primary/20">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Teste Grátis por 14 Dias</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Experimente todos os recursos Premium sem compromisso. 
              Cancele a qualquer momento durante o período de teste.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Sem cobrança antecipada</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Cancele quando quiser</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
// Subscription plan configuration
export const SUBSCRIPTION_PLANS = {
  FREE: {
    name: 'Free',
    priceId: process.env.NODE_ENV === 'production' 
      ? 'price_free_prod' // Replace with actual Stripe price ID
      : 'price_free_test', // Test mode price ID
    price: 0,
    currency: 'BRL',
    interval: 'month' as const,
    trialDays: undefined,
    features: [
      'Registro manual ilimitado de ativos',
      'Dashboard consolidado básico',
      'Timeline mensal (últimos 12 meses)',
      'Relatórios simples de evolução',
      'Suporte por email',
      'Modo escuro/claro'
    ],
    limitations: [
      'Histórico limitado a visão mensal',
      'Funcionalidades básicas de análise'
    ]
  },
  PREMIUM: {
    name: 'Premium',
    priceId: process.env.NODE_ENV === 'production' 
      ? 'price_premium_prod' // Replace with actual Stripe price ID
      : process.env.STRIPE_PREMIUM_PRICE_ID || 'price_1S3lmuRrF8MozMWzgDDcB06C', // Use env var or fallback
    price: 19.90,
    currency: 'BRL',
    interval: 'month' as const,
    trialDays: 14,
    features: [
      'Tudo do plano Free',
      'Timeline diária (histórico completo)',
      'Análises avançadas de performance',
      'Métricas de diversificação',
      'Relatórios detalhados de evolução',
      'Suporte prioritário',
      'Exportação de dados (em desenvolvimento)',
      'Acesso antecipado a novas funcionalidades'
    ],
    limitations: []
  }
} as const

export type PlanType = keyof typeof SUBSCRIPTION_PLANS

// Helper function to format currency
export const formatPrice = (price: number, currency: string = 'BRL') => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(price)
}

// Helper function to get plan by price ID
export const getPlanByPriceId = (priceId: string) => {
  return Object.values(SUBSCRIPTION_PLANS).find(plan => plan.priceId === priceId)
}
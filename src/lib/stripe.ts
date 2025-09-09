import { loadStripe, Stripe } from '@stripe/stripe-js'

// Singleton pattern for Stripe instance
let stripePromise: Promise<Stripe | null>

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
    )
  }
  return stripePromise
}

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
      : 'price_premium_test', // Test mode price ID
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

// Stripe webhook event types we handle
export const STRIPE_WEBHOOK_EVENTS = {
  CUSTOMER_SUBSCRIPTION_CREATED: 'customer.subscription.created',
  CUSTOMER_SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  CUSTOMER_SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
} as const
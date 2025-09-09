import { SUBSCRIPTION_PLANS } from '@/lib/stripe'
import type { Subscription } from '@/lib/services/subscription-service'

// Helper function to get plan name from subscription
export function getPlanName(subscription: Subscription | null): string {
  if (!subscription || !subscription.stripe_price_id) {
    return 'Free'
  }

  const plan = Object.values(SUBSCRIPTION_PLANS).find(
    p => p.priceId === subscription.stripe_price_id
  )

  return plan?.name || 'Unknown'
}

// Helper function to check if subscription is in trial
export function isTrialActive(subscription: Subscription | null): boolean {
  if (!subscription || !subscription.trial_end) {
    return false
  }

  return new Date(subscription.trial_end) > new Date()
}

// Helper function to get days remaining in trial
export function getTrialDaysRemaining(subscription: Subscription | null): number {
  if (!isTrialActive(subscription) || !subscription?.trial_end) {
    return 0
  }

  const trialEnd = new Date(subscription.trial_end)
  const now = new Date()
  const diffTime = trialEnd.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return Math.max(0, diffDays)
}